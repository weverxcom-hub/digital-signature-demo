"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea, FieldHint } from "@/components/ui/Input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";

type Profile = {
  name: string;
  shortName: string | null;
  tagline: string | null;
  address: string | null;
  website: string | null;
  logoUrl: string | null;
  primaryColor: string;
  verifyBaseUrl: string | null;
  logoMimeType?: string | null;
  logoUpdatedAt?: string | null;
};

const MAX_LOGO_KB = 2048;
const ACCEPTED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
  "image/gif",
];

export function ProfileForm({ initial }: { initial: Profile }) {
  const router = useRouter();
  const [form, setForm] = useState<Profile>(initial);
  const [saving, setSaving] = useState(false);
  const [hasUpload, setHasUpload] = useState<boolean>(!!initial.logoMimeType);
  const [logoVersion, setLogoVersion] = useState<number>(() =>
    initial.logoUpdatedAt ? new Date(initial.logoUpdatedAt).getTime() : 0
  );
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Free the object URL when the component unmounts or the preview is replaced.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function update<K extends keyof Profile>(key: K, value: Profile[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function uploadLogo(file: File) {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error(
        `Unsupported image type "${file.type || "unknown"}". Use PNG, JPG, WEBP, SVG, or GIF.`
      );
      return;
    }
    if (file.size > MAX_LOGO_KB * 1024) {
      toast.error(
        `File too large (${Math.round(file.size / 1024)}KB). Max ${MAX_LOGO_KB}KB.`
      );
      return;
    }
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/profile/logo", { method: "POST", body: fd });
    setUploading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      toast.error(data?.error || "Could not upload logo");
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setHasUpload(true);
    setLogoVersion(Date.now());
    toast.success("Logo uploaded");
    // Re-fetch server components so headers / verify page pick up the new logo.
    router.refresh();
  }

  async function removeUploadedLogo() {
    if (!hasUpload) return;
    setUploading(true);
    const res = await fetch("/api/profile/logo", { method: "DELETE" });
    setUploading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      toast.error(data?.error || "Could not remove logo");
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setHasUpload(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    toast.success("Logo removed");
    router.refresh();
  }

  // Resolve which logo image to show in the live preview.
  // - Just-picked file → local object URL (immediate, no roundtrip).
  // - Uploaded server logo → /api/profile/logo?v=<ts> (cache-busted).
  // - External URL → as-is (best-effort, may fail on bad URLs).
  const livePreviewSrc =
    previewUrl ?? (hasUpload ? `/api/profile/logo?v=${logoVersion}` : form.logoUrl?.trim() || null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        // empty strings → null
        shortName: form.shortName || null,
        tagline: form.tagline || null,
        address: form.address || null,
        website: form.website || "",
        logoUrl: form.logoUrl || "",
        verifyBaseUrl: form.verifyBaseUrl || "",
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      toast.error(data?.error || "Could not save profile");
      return;
    }
    toast.success("Organization profile updated");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Organization profile</h1>
        <p className="text-sm text-slate-500">
          This information appears on the landing page, dashboard header, and the
          public verification page that QR codes link to.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Identity</CardTitle>
          <CardDescription>Name, short name, tagline.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="name">Organization name *</Label>
            <Input
              id="name"
              required
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="shortName">Short name / acronym</Label>
              <Input
                id="shortName"
                value={form.shortName ?? ""}
                onChange={(e) => update("shortName", e.target.value)}
                placeholder="e.g. ACME"
              />
            </div>
            <div>
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                type="url"
                value={form.website ?? ""}
                onChange={(e) => update("website", e.target.value)}
                placeholder="https://example.ac.id"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="tagline">Tagline</Label>
            <Input
              id="tagline"
              value={form.tagline ?? ""}
              onChange={(e) => update("tagline", e.target.value)}
              placeholder="One-liner shown under the title."
            />
          </div>
          <div>
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              rows={2}
              value={form.address ?? ""}
              onChange={(e) => update("address", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Branding</CardTitle>
          <CardDescription>Logo and primary color.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <Label>Logo</Label>
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                {livePreviewSrc ? (
                  // Use a plain <img> to dodge next/image's loader pipeline,
                  // which is the source of most "logo tidak bisa terbaca"
                  // reports (bad URLs, CORS-fronted CDNs, SVGs without an
                  // accept header, etc.).
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={livePreviewSrc}
                    alt="Logo preview"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <span className="text-xs text-slate-400">No logo</span>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploading
                      ? "Uploading…"
                      : hasUpload
                      ? "Replace logo file"
                      : "Upload logo file"}
                  </Button>
                  {hasUpload && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={uploading}
                      onClick={removeUploadedLogo}
                    >
                      Remove
                    </Button>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_TYPES.join(",")}
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadLogo(f);
                  }}
                />
                <FieldHint>
                  PNG, JPG, WEBP, SVG, or GIF. Max {MAX_LOGO_KB}KB. Square
                  aspect ratio looks best. Uploaded files are stored on this
                  deployment — no external hosting needed.
                </FieldHint>
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="logoUrl">Logo URL (fallback)</Label>
            <Input
              id="logoUrl"
              type="url"
              value={form.logoUrl ?? ""}
              onChange={(e) => update("logoUrl", e.target.value)}
              placeholder="https://example.com/logo.png"
            />
            <FieldHint>
              Only used if no file is uploaded above. Must be a direct image
              URL (ending in .png/.jpg/.svg) — not a Google Drive or Dropbox
              page link.
            </FieldHint>
          </div>
          <div className="grid grid-cols-[120px_1fr] items-end gap-4">
            <div>
              <Label htmlFor="primaryColor">Primary color</Label>
              <Input
                id="primaryColor"
                type="color"
                value={form.primaryColor}
                onChange={(e) => update("primaryColor", e.target.value)}
                className="h-10 p-1"
              />
            </div>
            <div>
              <Input
                value={form.primaryColor}
                onChange={(e) => update("primaryColor", e.target.value)}
                placeholder="#0f766e"
              />
              <FieldHint>Hex color. Used in headers, buttons, and the QR verification page.</FieldHint>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Verification URL</CardTitle>
          <CardDescription>
            Domain to which QR codes will point.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="verifyBaseUrl">Verify base URL</Label>
            <Input
              id="verifyBaseUrl"
              type="url"
              value={form.verifyBaseUrl ?? ""}
              onChange={(e) => update("verifyBaseUrl", e.target.value)}
              placeholder="https://your-org.example.com"
            />
            <FieldHint>
              Defaults to the app URL if blank. Set to your official domain so
              QR codes resolve to <code>{form.verifyBaseUrl || "https://yourdomain.tld"}/verify/&lt;token&gt;</code>{" "}
              for public trust. The page at that route must point to this app
              (e.g. via subdomain or reverse-proxy).
            </FieldHint>
          </div>
        </CardContent>
      </Card>

      <CardFooter className="rounded-lg border border-slate-200 bg-white">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save profile"}
        </Button>
      </CardFooter>
    </form>
  );
}
