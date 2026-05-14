"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input, Label, FieldHint } from "@/components/ui/Input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";

export function SetupForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    organizationName: "",
    adminName: "",
    adminEmail: "",
    adminPassword: "",
  });
  const [loading, setLoading] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      toast.error(data?.error || "Setup failed");
      setLoading(false);
      return;
    }
    toast.success("Setup complete. Logging you in…");
    await signIn("credentials", {
      email: form.adminEmail,
      password: form.adminPassword,
      redirect: false,
    });
    router.push("/dashboard/profile");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>Welcome — first-time setup</CardTitle>
          <CardDescription>
            Create the first administrator and name your organization. You can
            update branding, logo, and verification URL afterwards.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="organizationName">Organization name</Label>
              <Input
                id="organizationName"
                value={form.organizationName}
                onChange={(e) => update("organizationName", e.target.value)}
                required
                placeholder="e.g. Acme Foundation"
              />
              <FieldHint>Shown on every verification page and document QR landing page.</FieldHint>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="adminName">Your name</Label>
                <Input
                  id="adminName"
                  value={form.adminName}
                  onChange={(e) => update("adminName", e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="adminEmail">Your email</Label>
                <Input
                  id="adminEmail"
                  type="email"
                  value={form.adminEmail}
                  onChange={(e) => update("adminEmail", e.target.value)}
                  required
                />
              </div>
            </div>
            <div>
              <Label htmlFor="adminPassword">Password</Label>
              <Input
                id="adminPassword"
                type="password"
                minLength={8}
                value={form.adminPassword}
                onChange={(e) => update("adminPassword", e.target.value)}
                required
              />
              <FieldHint>Minimum 8 characters.</FieldHint>
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Creating…" : "Create admin & continue"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
