"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";

type Signatory = {
  id: string;
  name: string;
  position: string;
  unit: string | null;
  nip: string | null;
  active: boolean;
};

const emptyForm = {
  id: "",
  name: "",
  position: "",
  unit: "",
  nip: "",
  active: true,
};

export function SignatoriesClient({ initial }: { initial: Signatory[] }) {
  const router = useRouter();
  const [list, setList] = useState<Signatory[]>(initial);
  const [editing, setEditing] = useState<typeof emptyForm | null>(null);
  const [busy, setBusy] = useState(false);

  function openCreate() {
    setEditing({ ...emptyForm });
  }
  function openEdit(s: Signatory) {
    setEditing({
      id: s.id,
      name: s.name,
      position: s.position,
      unit: s.unit ?? "",
      nip: s.nip ?? "",
      active: s.active,
    });
  }

  async function save() {
    if (!editing) return;
    setBusy(true);
    const body = {
      name: editing.name,
      position: editing.position,
      unit: editing.unit || null,
      nip: editing.nip || null,
      active: editing.active,
    };
    const isUpdate = !!editing.id;
    const res = await fetch(
      isUpdate ? `/api/signatories/${editing.id}` : "/api/signatories",
      {
        method: isUpdate ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    const data = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) {
      toast.error(data?.error || "Could not save");
      return;
    }
    toast.success(isUpdate ? "Signatory updated" : "Signatory added");
    setEditing(null);
    setList((prev) =>
      isUpdate
        ? prev.map((s) => (s.id === data.id ? data : s))
        : [data, ...prev]
    );
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("Soft-delete this signatory? Existing signatures remain valid.")) return;
    const res = await fetch(`/api/signatories/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      toast.error(data?.error || "Could not delete");
      return;
    }
    toast.success("Signatory removed");
    setList((prev) => prev.filter((s) => s.id !== id));
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">Signatories</h1>
          <p className="text-sm text-slate-500">
            People who can be selected as a signer when an admin signs an archive.
          </p>
        </div>
        <Button onClick={openCreate} className="shrink-0">
          Add signatory
        </Button>
      </div>

      {editing && (
        <Card>
          <CardHeader>
            <CardTitle>
              {editing.id ? "Edit signatory" : "Add signatory"}
            </CardTitle>
            <CardDescription>
              The full name and position are snapshotted into each signature so
              renaming a person later won&apos;t change past attestations.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="name">Full name *</Label>
                <Input
                  id="name"
                  required
                  value={editing.name}
                  onChange={(e) =>
                    setEditing({ ...editing, name: e.target.value })
                  }
                  placeholder="Prof. Dr. Ir. ... M.T."
                />
              </div>
              <div>
                <Label htmlFor="position">Position / title *</Label>
                <Input
                  id="position"
                  required
                  value={editing.position}
                  onChange={(e) =>
                    setEditing({ ...editing, position: e.target.value })
                  }
                  placeholder="Rektor, Wakil Rektor I, Dekan FE, …"
                />
              </div>
              <div>
                <Label htmlFor="unit">Unit / faculty</Label>
                <Input
                  id="unit"
                  value={editing.unit}
                  onChange={(e) =>
                    setEditing({ ...editing, unit: e.target.value })
                  }
                  placeholder="Optional"
                />
              </div>
              <div>
                <Label htmlFor="nip">NIP / employee ID</Label>
                <Input
                  id="nip"
                  value={editing.nip}
                  onChange={(e) =>
                    setEditing({ ...editing, nip: e.target.value })
                  }
                  placeholder="Optional"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editing.active}
                onChange={(e) =>
                  setEditing({ ...editing, active: e.target.checked })
                }
              />
              Active (eligible to sign)
            </label>
            <div className="flex gap-2">
              <Button onClick={save} disabled={busy}>
                {busy ? "Saving…" : "Save"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setEditing(null)}
                disabled={busy}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {list.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">
              No signatories yet. Add one to enable signing.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {list.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{s.name}</p>
                      {s.active ? (
                        <Badge variant="success">active</Badge>
                      ) : (
                        <Badge variant="warning">inactive</Badge>
                      )}
                    </div>
                    <p className="text-sm text-slate-600">{s.position}</p>
                    {(s.unit || s.nip) && (
                      <p className="text-xs text-slate-500">
                        {[s.unit, s.nip && `NIP ${s.nip}`]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(s)}>
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(s.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
