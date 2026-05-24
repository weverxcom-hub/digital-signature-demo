import { LoadingScreen } from "@/components/LoadingScreen";

export default function VerifyLoading() {
  return (
    <main className="min-h-screen bg-slate-50">
      <LoadingScreen label="Memverifikasi tanda tangan…" />
    </main>
  );
}
