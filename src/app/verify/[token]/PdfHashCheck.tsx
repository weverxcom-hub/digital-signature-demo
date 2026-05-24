"use client";

import { useState } from "react";

type CheckState =
  | { kind: "idle" }
  | { kind: "hashing" }
  | { kind: "match"; hash: string }
  | { kind: "mismatch"; hash: string }
  | { kind: "error"; message: string };

export function PdfHashCheck({ expectedHash }: { expectedHash: string }) {
  const [state, setState] = useState<CheckState>({ kind: "idle" });
  const [dragOver, setDragOver] = useState(false);

  async function handleFile(file: File | null) {
    if (!file) return;
    setState({ kind: "hashing" });
    try {
      const buffer = await file.arrayBuffer();
      const digest = await crypto.subtle.digest("SHA-256", buffer);
      const hex = Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      if (hex === expectedHash.toLowerCase()) {
        setState({ kind: "match", hash: hex });
      } else {
        setState({ kind: "mismatch", hash: hex });
      }
    } catch {
      setState({
        kind: "error",
        message:
          "Browser tidak mendukung perhitungan SHA-256 untuk file ini.",
      });
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        Drop atau pilih file PDF untuk membandingkan hash byte-for-byte dengan
        record. Hash dihitung di browser kamu — file tidak diunggah ke server.
      </p>
      <label
        htmlFor="pdfHashCheckInput"
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer?.files?.[0];
          if (file) {
            void handleFile(file);
          }
        }}
        className={
          "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-6 text-center text-sm transition " +
          (dragOver
            ? "border-emerald-500 bg-emerald-50 text-emerald-800"
            : "border-slate-300 bg-slate-50 text-slate-600 hover:bg-slate-100")
        }
      >
        <span className="font-medium">Drop PDF di sini</span>
        <span className="mt-1 text-xs">atau klik untuk pilih file</span>
        <input
          id="pdfHashCheckInput"
          type="file"
          accept="application/pdf"
          className="sr-only"
          onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
        />
      </label>

      {state.kind === "hashing" && (
        <p className="text-xs text-slate-500">Menghitung SHA-256…</p>
      )}

      {state.kind === "match" && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <p className="font-semibold">PDF cocok dengan record</p>
          <p className="mt-1 text-xs">
            Hash byte-for-byte sama persis dengan yang admin daftarkan.
          </p>
        </div>
      )}

      {state.kind === "mismatch" && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          <p className="font-semibold">
            PDF berbeda dari record — dokumen mungkin diubah
          </p>
          <p className="mt-1 break-all font-mono text-xs">
            Computed: {state.hash}
          </p>
          <p className="mt-1 break-all font-mono text-xs">
            Expected: {expectedHash.toLowerCase()}
          </p>
        </div>
      )}

      {state.kind === "error" && (
        <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          {state.message}
        </p>
      )}

      <p className="text-[11px] leading-snug text-slate-500">
        Catatan: pemeriksaan ini bersifat <em>client-side &amp; advisory</em>.
        Tidak adanya hash atau hash yang berbeda tidak meng-invalidate signature
        secara hukum, tetapi memberi sinyal tampering pada level file.
      </p>
    </div>
  );
}
