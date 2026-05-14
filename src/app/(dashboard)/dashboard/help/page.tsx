import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { getOrCreateOrganizationProfile } from "@/lib/profile";

export const dynamic = "force-dynamic";

const PANDUAN_URL =
  "https://github.com/weverxcom-hub/digital-signature-demo/blob/main/docs/PANDUAN.md";

export default async function HelpPage() {
  const profile = await getOrCreateOrganizationProfile();
  const verifyHost = profile.verifyBaseUrl?.replace(/^https?:\/\//, "") ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Panduan</h1>
          <p className="mt-1 text-sm text-slate-600">
            Ringkasan cara kerja sistem. Versi lengkap & sumber resmi ada di
            GitHub — bisa kamu edit langsung tanpa perlu deploy ulang.
          </p>
        </div>
        <a
          href={PANDUAN_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Buka panduan lengkap di GitHub →
        </a>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Alur singkat</CardTitle>
          <CardDescription>
            Lima langkah dari setup awal sampai dokumen siap dikirim.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="ml-4 list-decimal space-y-2 text-sm text-slate-700">
            <li>
              <strong>Konfigurasi organisasi</strong> sekali di awal
              (<Link className="underline" href="/dashboard/profile">Organization Profile</Link>):
              logo, brand color, dan <code>verifyBaseUrl</code> (domain resmi).
            </li>
            <li>
              <strong>Daftarkan penandatangan</strong>{" "}
              (<Link className="underline" href="/dashboard/signatories">Signatories</Link>) — Rektor,
              Dekan, dll. Sekali setup.
            </li>
            <li>
              <strong>Buat archive</strong>{" "}
              (<Link className="underline" href="/dashboard/archives">Archives</Link>): nomor surat,
              perihal, tanggal terbit, deskripsi opsional.
            </li>
            <li>
              <strong>Tandatangani</strong> — pilih signatory, klik{" "}
              <em>Sign archive</em>. Sistem membuat token, HMAC, dan QR code.
            </li>
            <li>
              <strong>Unduh visualisasi tanda tangan (PNG)</strong> dari detail
              archive, paste ke versi final PDF/Word, kirim. Penerima yang scan
              QR diarahkan ke halaman verifikasi resmi di domain instansi.
            </li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Status verifikasi</CardTitle>
          <CardDescription>
            Yang akan dilihat penerima saat scan QR.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li>
              <Badge variant="success">Signature valid</Badge> — dokumen sah,
              metadata cocok dengan record dan HMAC.
            </li>
            <li>
              <Badge variant="danger">Signature revoked</Badge> — admin telah
              mencabut tanda tangan. Dokumen tidak berlaku lagi.
            </li>
            <li>
              <Badge variant="warning">Integrity check failed</Badge> — ada
              field yang berubah setelah ditandatangani. Curigai dokumen palsu.
            </li>
            <li>
              <Badge variant="default">Not found</Badge> — token QR tidak
              cocok dengan record manapun. QR palsu atau record dihapus.
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Status domain saat ini</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-700">
          {verifyHost ? (
            <p className="rounded border border-emerald-200 bg-emerald-50 p-3 text-emerald-900">
              QR mengarah ke <strong>{verifyHost}</strong>. Pastikan domain
              ini sudah meneruskan <code>/verify/&lt;token&gt;</code> ke
              aplikasi.
            </p>
          ) : (
            <p className="rounded border border-amber-200 bg-amber-50 p-3 text-amber-900">
              <code>verifyBaseUrl</code> belum di-set di{" "}
              <Link className="underline" href="/dashboard/profile">
                Organization Profile
              </Link>
              . QR menggunakan host aplikasi (<code>NEXT_PUBLIC_APP_URL</code>)
              sebagai fallback.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mau update panduan ini?</CardTitle>
          <CardDescription>
            Edit langsung di GitHub — gak perlu nunggu deploy.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-700">
          <p>
            Sumber resmi panduan adalah file{" "}
            <code>docs/PANDUAN.md</code> di repo GitHub. Halaman dashboard ini
            hanya menampilkan ringkasannya — penjelasan lengkap, FAQ, dan
            resep setup domain ada di sana.
          </p>
          <ol className="ml-4 list-decimal space-y-1">
            <li>Buka file di GitHub.</li>
            <li>Klik ikon pensil (✏) di pojok kanan atas.</li>
            <li>Edit di browser, commit langsung ke <code>main</code>.</li>
          </ol>
          <a
            href={PANDUAN_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-emerald-700 underline hover:text-emerald-900"
          >
            docs/PANDUAN.md di GitHub →
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
