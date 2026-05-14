"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { formatDate, formatDateTime } from "@/lib/utils";

type Signature = {
  id: string;
  token: string;
  hmac: string;
  signatoryId: string;
  signatoryName: string;
  signatoryPosition: string;
  signatoryUnit: string | null;
  signedAt: string;
  revokedAt: string | null;
  revokedReason: string | null;
};

type ArchiveStatus = "DRAFT" | "PENDING" | "FULLY_SIGNED" | "REVOKED";

type RequiredSignatory = {
  id: string;
  signatoryId: string;
  signatory: {
    id: string;
    name: string;
    position: string;
    unit: string | null;
  };
};

type Archive = {
  id: string;
  number: string;
  subject: string;
  description: string | null;
  issuedAt: string;
  status: ArchiveStatus;
  createdBy: { id: string; name: string; email: string };
  signatures: Signature[];
  requiredSignatories: RequiredSignatory[];
};

type Signatory = { id: string; name: string; position: string };

type Profile = {
  name: string;
  shortName: string | null;
  logoUrl: string | null;
  primaryColor: string;
};

export function ArchiveDetailClient({
  archive,
  signatories,
  verifyUrl,
  profile,
}: {
  archive: Archive;
  signatories: Signatory[];
  verifyUrl: string | null;
  profile: Profile;
}) {
  const router = useRouter();
  const [busySignatoryId, setBusySignatoryId] = useState<string | null>(null);
  const [adHocSignatoryId, setAdHocSignatoryId] = useState(
    signatories[0]?.id ?? ""
  );
  const [adHocBusy, setAdHocBusy] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokeReason, setRevokeReason] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const [form, setForm] = useState({
    number: archive.number,
    subject: archive.subject,
    description: archive.description ?? "",
    issuedAt: archive.issuedAt.slice(0, 10),
  });
  // PDF embed state — admin uploads a PDF, server returns the stamped PDF as
  // a download. Nothing is persisted server-side (option (a) in the plan).
  const [embedFile, setEmbedFile] = useState<File | null>(null);
  const [embedPage, setEmbedPage] = useState<"last" | "first" | "all">(
    "last"
  );
  const [embedCorner, setEmbedCorner] = useState<
    "top-left" | "top-right" | "bottom-left" | "bottom-right"
  >("bottom-right");
  const [embedBusy, setEmbedBusy] = useState(false);

  const sortedSignatures = useMemo(
    () =>
      [...archive.signatures].sort(
        (a, b) => +new Date(b.signedAt) - +new Date(a.signedAt)
      ),
    [archive.signatures]
  );
  const activeSignatures = sortedSignatures.filter((s) => !s.revokedAt);
  const primarySignature =
    activeSignatures[0] ?? sortedSignatures[0] ?? null;
  const hasAnyActiveSignature = activeSignatures.length > 0;

  // Track which required signatories already have an active signature so
  // we can show pending/signed status and offer per-signer sign buttons.
  const requiredIdsActive = useMemo(
    () =>
      new Set(
        activeSignatures.map((s) => s.signatoryId).filter(Boolean) as string[]
      ),
    [activeSignatures]
  );

  // Signatory selected for ad-hoc QR/stamp preview (defaults to primary).
  const [previewSigId, setPreviewSigId] = useState<string | null>(
    primarySignature?.id ?? null
  );
  const previewSignature = previewSigId
    ? sortedSignatures.find((s) => s.id === previewSigId) ?? null
    : primarySignature;
  const showPreview =
    previewSignature !== null && !previewSignature.revokedAt && !!verifyUrl;

  async function signAs(signatoryId: string) {
    setBusySignatoryId(signatoryId);
    const res = await fetch(`/api/archives/${archive.id}/sign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signatoryId }),
    });
    setBusySignatoryId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      toast.error(data?.error || "Could not sign archive");
      return;
    }
    toast.success("Signature added");
    router.refresh();
  }

  async function signAdHoc() {
    if (!adHocSignatoryId) {
      toast.error("Pick a signatory first");
      return;
    }
    setAdHocBusy(true);
    const res = await fetch(`/api/archives/${archive.id}/sign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signatoryId: adHocSignatoryId }),
    });
    setAdHocBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      toast.error(data?.error || "Could not sign archive");
      return;
    }
    toast.success("Signature added");
    router.refresh();
  }

  async function revokeSignature(signatureId: string) {
    const reason = (revokeReason[signatureId] ?? "").trim();
    if (!reason) {
      toast.error("Please provide a reason for revocation");
      return;
    }
    setRevokingId(signatureId);
    const res = await fetch(`/api/archives/${archive.id}/sign/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signatureId, reason }),
    });
    setRevokingId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      toast.error(data?.error || "Could not revoke signature");
      return;
    }
    toast.success("Signature revoked");
    router.refresh();
  }

  async function embedPdf() {
    if (!embedFile) {
      toast.error("Choose a PDF file first");
      return;
    }
    if (!previewSignature || previewSignature.revokedAt) {
      toast.error("Pick an active signature to embed first");
      return;
    }
    setEmbedBusy(true);
    try {
      const data = new FormData();
      data.append("file", embedFile);
      data.append("signatureId", previewSignature.id);
      data.append("page", embedPage);
      data.append("corner", embedCorner);
      const res = await fetch(`/api/archives/${archive.id}/embed-pdf`, {
        method: "POST",
        body: data,
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        toast.error(payload?.error || "Could not embed stamp into PDF");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const fromHeader = res.headers
        .get("Content-Disposition")
        ?.match(/filename="([^"]+)"/)?.[1];
      a.download =
        fromHeader ||
        `signed-${archive.number}-${embedFile.name.replace(/\.[^.]+$/, "")}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Stamped PDF downloaded");
    } catch {
      toast.error("Could not embed stamp into PDF");
    } finally {
      setEmbedBusy(false);
    }
  }

  async function saveEdits() {
    setEditBusy(true);
    const res = await fetch(`/api/archives/${archive.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        number: form.number,
        subject: form.subject,
        description: form.description || null,
        issuedAt: new Date(form.issuedAt).toISOString(),
      }),
    });
    setEditBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      toast.error(data?.error || "Could not save");
      return;
    }
    toast.success("Archive updated");
    setEditing(false);
    router.refresh();
  }

  const statusBadge = archiveStatusBadge(archive.status);
  const requiredCount = archive.requiredSignatories.length;
  const signedRequiredCount = archive.requiredSignatories.filter((r) =>
    requiredIdsActive.has(r.signatoryId)
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{archive.number}</h1>
          <p className="text-sm text-slate-600">{archive.subject}</p>
          <p className="text-xs text-slate-500">
            Issued {formatDate(archive.issuedAt)} · created by{" "}
            {archive.createdBy.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
          {requiredCount > 0 && (
            <span className="text-xs text-slate-500">
              {signedRequiredCount}/{requiredCount} required signers
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="space-y-6 md:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Document metadata</CardTitle>
                  <CardDescription>
                    {hasAnyActiveSignature
                      ? "Locked while any signature is active. Revoke all signatures first to edit."
                      : "Edit the document metadata before signing."}
                  </CardDescription>
                </div>
                {!hasAnyActiveSignature &&
                  (editing ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditing(false)}
                    >
                      Cancel
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditing(true)}
                    >
                      Edit
                    </Button>
                  ))}
              </div>
            </CardHeader>
            <CardContent>
              {editing ? (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label htmlFor="number">Number</Label>
                      <Input
                        id="number"
                        value={form.number}
                        onChange={(e) =>
                          setForm({ ...form, number: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="issuedAt">Issued at</Label>
                      <Input
                        id="issuedAt"
                        type="date"
                        value={form.issuedAt}
                        onChange={(e) =>
                          setForm({ ...form, issuedAt: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="subject">Subject</Label>
                    <Input
                      id="subject"
                      value={form.subject}
                      onChange={(e) =>
                        setForm({ ...form, subject: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      rows={3}
                      value={form.description}
                      onChange={(e) =>
                        setForm({ ...form, description: e.target.value })
                      }
                    />
                  </div>
                  <Button onClick={saveEdits} disabled={editBusy}>
                    {editBusy ? "Saving…" : "Save"}
                  </Button>
                </div>
              ) : (
                <dl className="grid gap-3 text-sm md:grid-cols-2">
                  <Field label="Number">{archive.number}</Field>
                  <Field label="Issued at">{formatDate(archive.issuedAt)}</Field>
                  <Field label="Subject" wide>
                    {archive.subject}
                  </Field>
                  <Field label="Description" wide>
                    {archive.description || (
                      <span className="text-slate-400">—</span>
                    )}
                  </Field>
                </dl>
              )}
            </CardContent>
          </Card>

          {requiredCount > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Required signers</CardTitle>
                <CardDescription>
                  Each required signatory must sign before the archive becomes
                  fully signed. Add or revoke signatures as needed.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="divide-y divide-slate-100">
                  {archive.requiredSignatories.map((r) => {
                    const signed = requiredIdsActive.has(r.signatoryId);
                    const busy = busySignatoryId === r.signatoryId;
                    return (
                      <li
                        key={r.id}
                        className="flex flex-wrap items-center justify-between gap-3 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{r.signatory.name}</p>
                          <p className="text-xs text-slate-500">
                            {r.signatory.position}
                            {r.signatory.unit && ` · ${r.signatory.unit}`}
                          </p>
                        </div>
                        {signed ? (
                          <Badge variant="success">signed</Badge>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Badge variant="warning">pending</Badge>
                            <Button
                              size="sm"
                              onClick={() => signAs(r.signatoryId)}
                              disabled={busy}
                            >
                              {busy ? "Signing…" : "Sign as this signer"}
                            </Button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Signatures</CardTitle>
              <CardDescription>
                {sortedSignatures.length === 0
                  ? "No signatures yet."
                  : `${activeSignatures.length} active · ${
                      sortedSignatures.length - activeSignatures.length
                    } revoked`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {sortedSignatures.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Use the section below to add a signature.
                </p>
              ) : (
                <ul className="space-y-3">
                  {sortedSignatures.map((s) => (
                    <li
                      key={s.id}
                      className="rounded border border-slate-200 p-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{s.signatoryName}</p>
                            {s.revokedAt ? (
                              <Badge variant="danger">revoked</Badge>
                            ) : (
                              <Badge variant="success">active</Badge>
                            )}
                          </div>
                          <p className="text-xs text-slate-500">
                            {s.signatoryPosition}
                            {s.signatoryUnit && ` · ${s.signatoryUnit}`}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Signed at {formatDateTime(s.signedAt)}
                          </p>
                          {s.revokedAt && (
                            <p className="mt-1 text-xs text-red-700">
                              Revoked at {formatDateTime(s.revokedAt)}
                              {s.revokedReason && ` — ${s.revokedReason}`}
                            </p>
                          )}
                          <p className="mt-1 break-all text-xs text-slate-400">
                            Token:{" "}
                            <code className="rounded bg-slate-100 px-1 py-0.5">
                              {s.token}
                            </code>
                          </p>
                        </div>
                      </div>
                      {!s.revokedAt && (
                        <div className="mt-3 space-y-2">
                          <Label htmlFor={`reason-${s.id}`} className="text-xs">
                            Revoke this signature (super-admin)
                          </Label>
                          <div className="flex flex-wrap gap-2">
                            <Input
                              id={`reason-${s.id}`}
                              placeholder="Reason (required)"
                              value={revokeReason[s.id] ?? ""}
                              onChange={(e) =>
                                setRevokeReason((prev) => ({
                                  ...prev,
                                  [s.id]: e.target.value,
                                }))
                              }
                              className="min-w-[200px] flex-1"
                            />
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={revokingId === s.id}
                              onClick={() => revokeSignature(s.id)}
                            >
                              {revokingId === s.id ? "Revoking…" : "Revoke"}
                            </Button>
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {signatories.length === 0 ? (
                <p className="text-sm text-amber-700">
                  No active signatory available. Add one in the Signatories
                  page first.
                </p>
              ) : (
                <div className="rounded border border-dashed border-slate-300 p-3">
                  <Label htmlFor="adHocSignatory">Add a signature</Label>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <select
                      id="adHocSignatory"
                      className="block min-w-[200px] flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
                      value={adHocSignatoryId}
                      onChange={(e) => setAdHocSignatoryId(e.target.value)}
                    >
                      {signatories.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} — {s.position}
                        </option>
                      ))}
                    </select>
                    <Button onClick={signAdHoc} disabled={adHocBusy}>
                      {adHocBusy ? "Signing…" : "Sign"}
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Any active signatory can be added. Each signatory may only
                    hold one active signature at a time per archive.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {showPreview && previewSignature && (
            <Card>
              <CardHeader>
                <CardTitle>Tempel stamp ke PDF</CardTitle>
                <CardDescription>
                  Upload PDF dokumen aslimu. Sistem akan menempelkan QR +
                  visualisasi tanda tangan ke halaman yang kamu pilih dan
                  langsung mengirim PDF hasilnya untuk diunduh. PDF tidak
                  disimpan di server.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label htmlFor="embedFile">PDF source (max 10 MB)</Label>
                  <Input
                    id="embedFile"
                    type="file"
                    accept="application/pdf"
                    onChange={(e) =>
                      setEmbedFile(e.target.files?.[0] ?? null)
                    }
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <Label htmlFor="embedPage">Page</Label>
                    <select
                      id="embedPage"
                      className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
                      value={embedPage}
                      onChange={(e) =>
                        setEmbedPage(
                          e.target.value as "last" | "first" | "all"
                        )
                      }
                    >
                      <option value="last">Last page</option>
                      <option value="first">First page</option>
                      <option value="all">All pages</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="embedCorner">Corner</Label>
                    <select
                      id="embedCorner"
                      className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
                      value={embedCorner}
                      onChange={(e) =>
                        setEmbedCorner(
                          e.target.value as
                            | "top-left"
                            | "top-right"
                            | "bottom-left"
                            | "bottom-right"
                        )
                      }
                    >
                      <option value="bottom-right">Bottom-right</option>
                      <option value="bottom-left">Bottom-left</option>
                      <option value="top-right">Top-right</option>
                      <option value="top-left">Top-left</option>
                    </select>
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  Using signature:{" "}
                  <span className="font-medium text-slate-700">
                    {previewSignature.signatoryName}
                  </span>
                  {" \u00b7 "}
                  {previewSignature.signatoryPosition}
                  {activeSignatures.length > 1 &&
                    " (change in the QR card above)"}
                </p>
                <Button
                  onClick={embedPdf}
                  disabled={embedBusy || !embedFile}
                >
                  {embedBusy ? "Embedding\u2026" : "Embed & download"}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Verification QR</CardTitle>
              <CardDescription>
                Embed this on the printed/PDF version of your document.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {showPreview && previewSignature ? (
                <div className="space-y-3 text-center">
                  {activeSignatures.length > 1 && (
                    <div className="text-left">
                      <Label
                        htmlFor="previewSig"
                        className="text-xs text-slate-500"
                      >
                        Signature
                      </Label>
                      <select
                        id="previewSig"
                        className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
                        value={previewSignature.id}
                        onChange={(e) => setPreviewSigId(e.target.value)}
                      >
                        {activeSignatures.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.signatoryName} — {s.signatoryPosition}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="mx-auto inline-block rounded-lg border border-slate-200 bg-white p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/archives/${archive.id}/qr?sigId=${previewSignature.id}`}
                      alt="Verification QR"
                      width={240}
                      height={240}
                      className="h-60 w-60"
                    />
                  </div>
                  <p className="break-all rounded bg-slate-100 p-2 text-xs">
                    {verifyUrlForToken(verifyUrl, previewSignature.token)}
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    <a
                      href={`/api/archives/${archive.id}/qr?sigId=${previewSignature.id}`}
                      download={`qr-${archive.number}.png`}
                    >
                      <Button size="sm" variant="outline">
                        Download QR (PNG)
                      </Button>
                    </a>
                    <a
                      href={`/api/archives/${archive.id}/qr?sigId=${previewSignature.id}&format=svg`}
                      download={`qr-${archive.number}.svg`}
                    >
                      <Button size="sm" variant="outline">
                        Download QR (SVG)
                      </Button>
                    </a>
                    <a
                      href={verifyUrlForToken(verifyUrl, previewSignature.token)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Button size="sm" variant="ghost">
                        Open
                      </Button>
                    </a>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  Sign this archive first to generate a QR code.
                </p>
              )}
            </CardContent>
          </Card>

          {showPreview && previewSignature && (
            <Card>
              <CardHeader>
                <CardTitle>Visualisasi tanda tangan</CardTitle>
                <CardDescription>
                  Composite image (QR + signatory text). Paste onto the
                  PDF/Word version of your document where the wet signature
                  would normally go.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="overflow-hidden rounded-lg border border-slate-200 bg-white p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/archives/${archive.id}/stamp?sigId=${previewSignature.id}`}
                    alt="Signature visualization"
                    className="h-auto w-full"
                  />
                </div>
                <a
                  href={`/api/archives/${archive.id}/stamp?sigId=${previewSignature.id}`}
                  download={`stamp-${archive.number}.png`}
                  className="block"
                >
                  <Button size="sm" className="w-full">
                    Download visualisasi (PNG)
                  </Button>
                </a>
              </CardContent>
            </Card>
          )}

          {profile.logoUrl && (
            <Card>
              <CardHeader>
                <CardTitle>Branding preview</CardTitle>
                <CardDescription>
                  Public verification page will show this org identity.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center gap-3">
                <Image
                  src={profile.logoUrl}
                  alt={profile.name}
                  width={48}
                  height={48}
                  className="h-12 w-12 rounded object-contain"
                  unoptimized
                />
                <div>
                  <p className="font-medium">{profile.name}</p>
                  <p className="text-xs text-slate-500">
                    Brand color{" "}
                    <span
                      className="ml-1 inline-block h-3 w-3 rounded"
                      style={{ backgroundColor: profile.primaryColor }}
                    />
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  wide,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "md:col-span-2" : ""}>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-900">{children}</dd>
    </div>
  );
}

function archiveStatusBadge(status: ArchiveStatus): {
  label: string;
  variant: "default" | "success" | "warning" | "danger" | "info";
} {
  switch (status) {
    case "DRAFT":
      return { label: "draft", variant: "default" };
    case "PENDING":
      return { label: "pending", variant: "warning" };
    case "FULLY_SIGNED":
      return { label: "signed", variant: "success" };
    case "REVOKED":
      return { label: "revoked", variant: "danger" };
  }
}

/**
 * The server-side primary verify URL is computed for the primary signature
 * only. Rebuild for the selected preview signature by swapping the trailing
 * token segment.
 */
function verifyUrlForToken(
  primaryVerifyUrl: string | null,
  token: string
): string {
  if (!primaryVerifyUrl) return "";
  return primaryVerifyUrl.replace(/\/verify\/[^/]+$/, `/verify/${token}`);
}
