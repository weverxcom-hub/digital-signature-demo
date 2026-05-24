import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PROFILE_ID } from "@/lib/profile";
import { logAudit } from "@/lib/audit";
import { rateLimitByUser } from "@/lib/rateLimit";

// Max upload size for the organization logo. Logos are decorative and small
// (typically <50KB); a 2MB ceiling is generous and protects the DB row.
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
  "image/gif",
]);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stream the uploaded logo bytes. Anonymous endpoint — the logo is visible
 * on every public page anyway. Cached aggressively so the dashboard and
 * /verify pages can reuse it across navigations.
 *
 * Supports conditional GET via `If-Modified-Since` so revisits return 304
 * (header-only, no body, no DB read of `logoBytes`). This noticeably cuts
 * the loading-screen flicker on slow connections.
 */
export async function GET(req: Request) {
  // Cheap header-only probe first so we can serve 304 / 404 without
  // pulling the binary bytes off the row.
  const meta = await prisma.organizationProfile.findUnique({
    where: { id: DEFAULT_PROFILE_ID },
    select: { logoMimeType: true, logoUpdatedAt: true },
  });
  if (!meta || !meta.logoMimeType || !meta.logoUpdatedAt) {
    return new NextResponse("Not found", {
      status: 404,
      headers: { "Cache-Control": "public, max-age=60" },
    });
  }

  const lastModified = meta.logoUpdatedAt.toUTCString();
  const ifModifiedSince = req.headers.get("if-modified-since");

  // Defense-in-depth headers when the logo is served as a standalone
  // document. SVG can contain <script> tags that execute when the user
  // navigates to the URL directly (browsers do NOT execute scripts inside
  // SVG loaded via <img src>, but they DO for direct navigation). The CSP
  // pins resources to data/blob only and forbids script, object, and frame
  // resources entirely. `sandbox` strips DOM origin privileges as well.
  //
  // For raster formats the CSP is harmless overhead but keeps headers
  // uniform regardless of the uploaded type.
  const securityHeaders: Record<string, string> = {
    "Content-Security-Policy":
      "default-src 'none'; img-src 'self' data: blob:; style-src 'unsafe-inline'; sandbox",
    "X-Content-Type-Options": "nosniff",
    // Force the browser to render the response in a way consistent with the
    // declared content-type, never as an inline document inside a parent
    // page. Most uses are <img src>, which ignores this header.
    "Cross-Origin-Resource-Policy": "same-site",
    // Block downloads from masquerading as something else. Filename is
    // generic; the actual extension comes from the MIME type.
    "Content-Disposition": "inline; filename=\"logo\"",
  };

  if (ifModifiedSince && ifModifiedSince === lastModified) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        "Last-Modified": lastModified,
        "Cache-Control": "public, max-age=86400, must-revalidate",
        ...securityHeaders,
      },
    });
  }

  const row = await prisma.organizationProfile.findUnique({
    where: { id: DEFAULT_PROFILE_ID },
    select: { logoBytes: true },
  });
  if (!row?.logoBytes) {
    return new NextResponse("Not found", { status: 404 });
  }
  const buf = Buffer.from(row.logoBytes);
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": meta.logoMimeType,
      "Content-Length": String(buf.byteLength),
      // 1 day in the browser; ?v=<timestamp> on the client busts the cache
      // whenever the admin uploads a new logo.
      "Cache-Control": "public, max-age=86400, must-revalidate",
      "Last-Modified": lastModified,
      ...securityHeaders,
    },
  });
}

/**
 * Replace the uploaded logo. Multipart form with a single `file` field.
 * Admin-only. Validates content type + size before writing.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const rl = await rateLimitByUser(req, "profileLogo", session.user.id);
  if (rl) return rl;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data" },
      { status: 400 }
    );
  }
  const file = form.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      {
        error: `Unsupported image type "${file.type}". Use PNG, JPG, WEBP, SVG, or GIF.`,
      },
      { status: 400 }
    );
  }
  if (file.size > MAX_LOGO_BYTES) {
    return NextResponse.json(
      {
        error: `File too large (${(file.size / 1024).toFixed(0)}KB). Max ${MAX_LOGO_BYTES / 1024}KB.`,
      },
      { status: 400 }
    );
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "Empty file" }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  // SVG content sanity check. Even with strict CSP on the serve path, we
  // reject obvious script and event-handler payloads here so a future
  // admin who navigates straight to the logo URL on a browser with broken
  // CSP support is still safe. Conservative: just deny script-y patterns.
  if (file.type === "image/svg+xml") {
    const svgText = bytes.toString("utf8");
    const dangerous = [
      /<script[\s>]/i,
      /<foreignobject[\s>]/i,
      /\son\w+\s*=/i, // onload=, onclick=, etc.
      /javascript:/i,
      /<!entity/i, // XXE-style entity declarations
    ];
    for (const pat of dangerous) {
      if (pat.test(svgText)) {
        return NextResponse.json(
          {
            error:
              "SVG rejected: contains script, event handler, or external entity. Re-export the logo from a vector editor without scripts.",
          },
          { status: 400 }
        );
      }
    }
  }

  const now = new Date();

  await prisma.organizationProfile.upsert({
    where: { id: DEFAULT_PROFILE_ID },
    update: {
      logoBytes: bytes,
      logoMimeType: file.type,
      logoUpdatedAt: now,
    },
    create: {
      id: DEFAULT_PROFILE_ID,
      logoBytes: bytes,
      logoMimeType: file.type,
      logoUpdatedAt: now,
    },
  });

  await logAudit({
    action: "PROFILE_LOGO_UPLOAD",
    entityType: "OrganizationProfile",
    entityId: DEFAULT_PROFILE_ID,
    userId: session.user.id,
    metadata: { mimeType: file.type, size: file.size },
  });

  return NextResponse.json({
    ok: true,
    mimeType: file.type,
    size: file.size,
    updatedAt: now.toISOString(),
  });
}

/**
 * Remove the uploaded logo. The external `logoUrl` field is untouched —
 * removing the upload simply falls back to that URL (if set) or the
 * text-initial placeholder.
 */
export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const rl = await rateLimitByUser(req, "profileLogo", session.user.id);
  if (rl) return rl;

  await prisma.organizationProfile.update({
    where: { id: DEFAULT_PROFILE_ID },
    data: {
      logoBytes: null,
      logoMimeType: null,
      logoUpdatedAt: null,
    },
  });

  await logAudit({
    action: "PROFILE_LOGO_REMOVE",
    entityType: "OrganizationProfile",
    entityId: DEFAULT_PROFILE_ID,
    userId: session.user.id,
  });

  return NextResponse.json({ ok: true });
}
