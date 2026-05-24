"use client";

import { useState } from "react";
import Link from "next/link";
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
import { formatDate } from "@/lib/utils";

type Signature = {
  id: string;
  token: string;
  signedAt: string;
  revokedAt: string | null;
  signatoryId: string;
  signatoryName: string;
  signatoryPosition: string;
};

type ArchiveStatus = "DRAFT" | "PENDING" | "FULLY_SIGNED" | "REVOKED";

type RequiredSignatoryRow = {
  signatoryId: string;
  signatory: { id: string; name: string; position: string };
};

type Archive = {
  id: string;
  number: string;
  subject: string;
  description: string | null;
  issuedAt: string;
  status: ArchiveStatus;
  signatures: Signature[];
  requiredSignatories: RequiredSignatoryRow[];
};

type Signatory = {
  id: string;
  name: string;
  position: string;
};

export function ArchivesClient({
  initialArchives,
  initialTotal,
  pageSize,
  signatories,
}: {
  initialArchives: Archive[];
  initialTotal: number;
  pageSize: number;
  signatories: Signatory[];
}) {
  const router = useRouter();
  const [archives, setArchives] = useState<Archive[]>(initialArchives);
  const [total, setTotal] = useState<number>(initialTotal);
  const [loadingMore, setLoadingMore] = useState(false);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [form, setForm] = useState({
    number: "",
    subject: "",
    description: "",
    issuedAt: new Date().toISOString().slice(0, 10),
  });
  const [requiredIds, setRequiredIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  function toggleRequired(id: string) {
    setRequiredIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function create() {
    setBusy(true);
    const res = await fetch("/api/archives", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        number: form.number,
        subject: form.subject,
        description: form.description || null,
        issuedAt: new Date(form.issuedAt).toISOString(),
        requiredSignatoryIds: requiredIds,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      toast.error(data?.error || "Could not create archive");
      return;
    }
    const created = await res.json();
    setArchives((prev) => [
      {
        ...created,
        signatures: [],
        requiredSignatories: signatories
          .filter((s) => requiredIds.includes(s.id))
          .map((s) => ({
            signatoryId: s.id,
            signatory: { id: s.id, name: s.name, position: s.position },
          })),
      },
      ...prev,
    ]);
    setTotal((t) => t + 1);
    setForm({
      number: "",
      subject: "",
      description: "",
      issuedAt: new Date().toISOString().slice(0, 10),
    });
    setRequiredIds([]);
    setCreating(false);
    toast.success("Archive created");
    router.refresh();
  }

  // Builds the API query string from the supplied search input. Stays
  // empty when the user hasn't typed anything so the server returns
  // the unfiltered first page.
  function buildQuery(skip: number, take: number, q: string) {
    const params = new URLSearchParams();
    params.set("skip", String(skip));
    params.set("take", String(take));
    if (q.trim()) params.set("q", q.trim());
    return params.toString();
  }

  async function loadMore() {
    setLoadingMore(true);
    try {
      const res = await fetch(
        `/api/archives?${buildQuery(archives.length, pageSize, query)}`
      );
      if (!res.ok) {
        toast.error("Could not load more archives");
        return;
      }
      const data = await res.json();
      const incoming: Archive[] = Array.isArray(data?.items) ? data.items : [];
      setArchives((prev) => {
        const known = new Set(prev.map((a) => a.id));
        return [...prev, ...incoming.filter((a) => !known.has(a.id))];
      });
      if (typeof data?.total === "number") {
        setTotal(data.total);
      }
    } finally {
      setLoadingMore(false);
    }
  }

  async function runSearch(e?: React.FormEvent, qOverride?: string) {
    e?.preventDefault();
    const q = qOverride ?? query;
    setSearching(true);
    try {
      const res = await fetch(`/api/archives?${buildQuery(0, pageSize, q)}`);
      if (!res.ok) {
        toast.error("Could not run search");
        return;
      }
      const data = await res.json();
      const incoming: Archive[] = Array.isArray(data?.items) ? data.items : [];
      setArchives(incoming);
      if (typeof data?.total === "number") setTotal(data.total);
    } finally {
      setSearching(false);
    }
  }

  function clearSearch() {
    if (!query) return;
    setQuery("");
    // Pass the empty query explicitly because state updates haven't
    // applied yet at this point in the event handler.
    runSearch(undefined, "");
  }

  const hasMore = archives.length < total;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">Archives</h1>
          <p className="text-sm text-slate-500">
            Documents that can be signed and verified by QR.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Showing {archives.length} of {total}
          </p>
        </div>
        <Button
          onClick={() => setCreating((v) => !v)}
          className="shrink-0"
        >
          {creating ? "Cancel" : "New archive"}
        </Button>
      </div>

      <form
        onSubmit={runSearch}
        className="flex flex-wrap gap-2"
        role="search"
      >
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by number or subject…"
          aria-label="Search archives"
          className="min-w-[200px] flex-1"
        />
        <Button type="submit" variant="outline" disabled={searching}>
          {searching ? "Searching…" : "Search"}
        </Button>
        {query && (
          <Button
            type="button"
            variant="ghost"
            onClick={clearSearch}
            disabled={searching}
          >
            Clear
          </Button>
        )}
      </form>

      {creating && (
        <Card>
          <CardHeader>
            <CardTitle>New archive</CardTitle>
            <CardDescription>
              Enter the document metadata. You&apos;ll be able to sign it on the
              detail page.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="number">Document number *</Label>
                <Input
                  id="number"
                  required
                  value={form.number}
                  onChange={(e) => setForm({ ...form, number: e.target.value })}
                  placeholder="e.g. 001/ACME/REK/I/2026"
                />
              </div>
              <div>
                <Label htmlFor="issuedAt">Issued at *</Label>
                <Input
                  id="issuedAt"
                  type="date"
                  required
                  value={form.issuedAt}
                  onChange={(e) =>
                    setForm({ ...form, issuedAt: e.target.value })
                  }
                />
              </div>
            </div>
            <div>
              <Label htmlFor="subject">Subject *</Label>
              <Input
                id="subject"
                required
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder="Perihal / subject of the letter"
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
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <Label>Required signers (optional)</Label>
                <p className="text-xs text-slate-500">
                  {requiredIds.length
                    ? `${requiredIds.length} selected`
                    : "Leave blank for ad-hoc signing"}
                </p>
              </div>
              {signatories.length === 0 ? (
                <p className="text-xs text-amber-700">
                  No signatories available. Add some in the{" "}
                  <Link href="/dashboard/signatories" className="underline">
                    Signatories
                  </Link>{" "}
                  page first.
                </p>
              ) : (
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-slate-200 bg-white p-2">
                  {signatories.map((s) => {
                    const checked = requiredIds.includes(s.id);
                    return (
                      <label
                        key={s.id}
                        className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleRequired(s.id)}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        <span className="flex-1">
                          <span className="font-medium">{s.name}</span>
                          <span className="text-slate-500"> — {s.position}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
              <p className="text-xs text-slate-500">
                Required signers must each sign before the archive is
                <span className="mx-1 font-medium text-emerald-700">
                  FULLY_SIGNED
                </span>
                . Until then the archive stays
                <span className="mx-1 font-medium text-amber-700">PENDING</span>.
              </p>
            </div>
            <Button onClick={create} disabled={busy}>
              {busy ? "Creating…" : "Create archive"}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {archives.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">
              No archives yet. Create one to start signing.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {archives.map((a) => {
                const status = archiveStatusBadge(a.status);
                const active = a.signatures.find((s) => !s.revokedAt);
                const requiredCount = a.requiredSignatories.length;
                const signedRequired = requiredCount
                  ? a.requiredSignatories.filter((r) =>
                      a.signatures.some(
                        (s) => s.signatoryId === r.signatoryId && !s.revokedAt
                      )
                    ).length
                  : 0;
                return (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-center justify-between gap-3 p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/dashboard/archives/${a.id}`}
                          className="font-semibold hover:underline"
                        >
                          {a.number}
                        </Link>
                        <Badge variant={status.variant}>{status.label}</Badge>
                        {requiredCount > 0 && (
                          <span className="text-xs text-slate-500">
                            {signedRequired}/{requiredCount} required signers
                          </span>
                        )}
                      </div>
                      <p className="truncate text-sm text-slate-700">{a.subject}</p>
                      <p className="text-xs text-slate-500">
                        Issued {formatDate(a.issuedAt)}
                        {active && (
                          <>
                            {" · signed by "}
                            <span className="font-medium">
                              {active.signatoryName}
                            </span>{" "}
                            ({active.signatoryPosition})
                          </>
                        )}
                      </p>
                    </div>
                    <Link href={`/dashboard/archives/${a.id}`}>
                      <Button variant="outline" size="sm">
                        Open
                      </Button>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {hasMore && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={loadMore}
            disabled={loadingMore}
          >
            {loadingMore ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}

      {signatories.length === 0 && (
        <p className="text-xs text-amber-700">
          Tip: add at least one signatory in{" "}
          <Link href="/dashboard/signatories" className="underline">
            Signatories
          </Link>{" "}
          before trying to sign an archive.
        </p>
      )}
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
