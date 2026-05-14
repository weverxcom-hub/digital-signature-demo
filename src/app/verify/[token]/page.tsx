import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getOrCreateOrganizationProfile } from "@/lib/profile";
import { verifySignatureHmac } from "@/lib/signature";
import { formatDate, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

type VerifyStatus = "valid" | "revoked" | "tampered" | "not_found";

export default async function VerifyPage({
  params,
}: {
  params: { token: string };
}) {
  const [sig, profile] = await Promise.all([
    prisma.archiveSignature.findUnique({
      where: { token: params.token },
      include: { archive: true },
    }),
    getOrCreateOrganizationProfile(),
  ]);

  let status: VerifyStatus = "valid";
  if (!sig) status = "not_found";
  else if (sig.revokedAt) status = "revoked";
  else if (
    !verifySignatureHmac(
      {
        archiveId: sig.archiveId,
        number: sig.archive.number,
        subject: sig.archive.subject,
        issuedAt: sig.archive.issuedAt,
        signatoryId: sig.signatoryId,
        signatoryName: sig.signatoryName,
        signatoryPosition: sig.signatoryPosition,
        signedAt: sig.signedAt,
      },
      sig.token,
      sig.hmac
    )
  )
    status = "tampered";

  const palette = paletteFor(status, profile.primaryColor);

  return (
    <main className="min-h-screen" style={{ backgroundColor: palette.bg }}>
      <div className="mx-auto max-w-2xl px-4 py-10">
        <header className="mb-6 flex items-center gap-3">
          {profile.logoUrl ? (
            <Image
              src={profile.logoUrl}
              alt={profile.name}
              width={48}
              height={48}
              className="h-12 w-12 rounded bg-white object-contain p-1 shadow-sm"
              unoptimized
            />
          ) : (
            <div
              className="flex h-12 w-12 items-center justify-center rounded text-sm font-semibold text-white"
              style={{ backgroundColor: profile.primaryColor }}
            >
              {(
                profile.shortName?.slice(0, 2) || profile.name.slice(0, 2)
              ).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-slate-900">{profile.name}</p>
            <p className="text-xs text-slate-500">Signature verification</p>
          </div>
        </header>

        <div
          className="overflow-hidden rounded-2xl border bg-white shadow-sm"
          style={{ borderColor: palette.border }}
        >
          <div
            className="px-6 py-6 text-white"
            style={{ backgroundColor: palette.accent }}
          >
            <div className="flex items-center gap-3">
              <StatusIcon status={status} />
              <div>
                <p className="text-xs uppercase tracking-wide opacity-80">
                  Verification result
                </p>
                <h1 className="text-2xl font-semibold">{titleFor(status)}</h1>
              </div>
            </div>
            <p className="mt-3 text-sm text-white/90">{messageFor(status)}</p>
          </div>

          <div className="space-y-4 px-6 py-6">
            {sig ? (
              <>
                <Section title="Document">
                  <FieldRow label="Number">
                    <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                      {sig.archive.number}
                    </code>
                  </FieldRow>
                  <FieldRow label="Subject">{sig.archive.subject}</FieldRow>
                  {sig.archive.description && (
                    <FieldRow label="Description">
                      {sig.archive.description}
                    </FieldRow>
                  )}
                  <FieldRow label="Issued">
                    {formatDate(sig.archive.issuedAt)}
                  </FieldRow>
                </Section>

                <Section title="Signatory">
                  <FieldRow label="Name">{sig.signatoryName}</FieldRow>
                  <FieldRow label="Position">{sig.signatoryPosition}</FieldRow>
                  {sig.signatoryUnit && (
                    <FieldRow label="Unit">{sig.signatoryUnit}</FieldRow>
                  )}
                  <FieldRow label="Signed at">
                    {formatDateTime(sig.signedAt)}
                  </FieldRow>
                </Section>

                {status === "revoked" && (
                  <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                    <p className="font-medium">
                      Revoked on {sig.revokedAt && formatDateTime(sig.revokedAt)}
                    </p>
                    {sig.revokedReason && (
                      <p className="mt-1">Reason: {sig.revokedReason}</p>
                    )}
                  </div>
                )}

                <details className="rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                  <summary className="cursor-pointer font-medium text-slate-700">
                    Technical details
                  </summary>
                  <dl className="mt-2 space-y-1">
                    <div>
                      <dt className="inline font-medium">Token:</dt>{" "}
                      <code className="break-all">{sig.token}</code>
                    </div>
                    <div>
                      <dt className="inline font-medium">HMAC (SHA-256):</dt>{" "}
                      <code className="break-all">{sig.hmac}</code>
                    </div>
                  </dl>
                </details>
              </>
            ) : (
              <p className="text-sm text-slate-600">
                No record matches the token <code>{params.token}</code>.
              </p>
            )}
          </div>
        </div>

        <footer className="mt-6 text-center text-xs text-slate-500">
          {profile.website ? (
            <Link href={profile.website} className="hover:underline">
              {profile.website}
            </Link>
          ) : null}
          <p className="mt-2">
            This page is the official verification endpoint for documents
            signed via {profile.name}.{" "}
            <Link href="/about" className="underline hover:text-slate-700">
              Pelajari cara kerjanya
            </Link>
            .
          </p>
        </footer>
      </div>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-xs uppercase tracking-wide text-slate-500">
        {title}
      </h3>
      <dl className="mt-1 divide-y divide-slate-100 rounded border border-slate-100">
        {children}
      </dl>
    </div>
  );
}

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-2 px-3 py-2 text-sm">
      <dt className="w-24 text-xs text-slate-500">{label}</dt>
      <dd className="flex-1 text-slate-900">{children}</dd>
    </div>
  );
}

function paletteFor(status: VerifyStatus, primary: string) {
  if (status === "valid") {
    return {
      accent: primary,
      bg: "#f8fafc",
      border: "#e2e8f0",
    };
  }
  if (status === "revoked") {
    return {
      accent: "#b91c1c",
      bg: "#fef2f2",
      border: "#fecaca",
    };
  }
  if (status === "tampered") {
    return {
      accent: "#b45309",
      bg: "#fffbeb",
      border: "#fde68a",
    };
  }
  return { accent: "#475569", bg: "#f8fafc", border: "#e2e8f0" };
}

function titleFor(status: VerifyStatus) {
  switch (status) {
    case "valid":
      return "Signature valid";
    case "revoked":
      return "Signature revoked";
    case "tampered":
      return "Integrity check failed";
    case "not_found":
      return "Not found";
  }
}

function messageFor(status: VerifyStatus) {
  switch (status) {
    case "valid":
      return "This document was signed by the listed signatory. Details below match the official records.";
    case "revoked":
      return "This signature has been revoked. The document should no longer be considered valid.";
    case "tampered":
      return "The signature record failed an HMAC integrity check. Treat this document as suspicious and contact the issuer.";
    case "not_found":
      return "We could not find a signature record matching this token. The QR may be invalid or expired.";
  }
}

function StatusIcon({ status }: { status: VerifyStatus }) {
  // Render via plain SVG for portability across hosting/PDF embeds.
  const stroke = "currentColor";
  if (status === "valid") {
    return (
      <svg
        width="36"
        height="36"
        viewBox="0 0 24 24"
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    );
  }
  if (status === "revoked") {
    return (
      <svg
        width="36"
        height="36"
        viewBox="0 0 24 24"
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    );
  }
  if (status === "tampered") {
    return (
      <svg
        width="36"
        height="36"
        viewBox="0 0 24 24"
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    );
  }
  return (
    <svg
      width="36"
      height="36"
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}
