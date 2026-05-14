"use client";

import { useState } from "react";
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
};

export function ProfileForm({ initial }: { initial: Profile }) {
  const [form, setForm] = useState<Profile>(initial);
  const [saving, setSaving] = useState(false);

  function update<K extends keyof Profile>(key: K, value: Profile[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

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
          <div>
            <Label htmlFor="logoUrl">Logo URL</Label>
            <Input
              id="logoUrl"
              type="url"
              value={form.logoUrl ?? ""}
              onChange={(e) => update("logoUrl", e.target.value)}
              placeholder="https://example.com/logo.png"
            />
            <FieldHint>
              PNG/SVG/JPG. Square aspect ratio looks best. For v1 we use a URL
              instead of file upload — host it on your CDN or static bucket.
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
