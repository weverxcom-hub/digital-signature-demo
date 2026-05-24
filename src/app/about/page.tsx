import Link from "next/link";
import { getOrCreateOrganizationProfile } from "@/lib/profile";
import { LogoMark } from "@/components/LogoMark";

export const dynamic = "force-dynamic";

export default async function AboutPage() {
  const profile = await getOrCreateOrganizationProfile();
  const verifyHost =
    profile.verifyBaseUrl?.replace(/^https?:\/\//, "") ??
    "(belum dikonfigurasi)";

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-2xl px-4 py-10">
        <header className="mb-8 flex items-center gap-3">
          <LogoMark
            profile={profile}
            size={48}
            className="bg-white p-1 shadow-sm"
          />
          <div>
            <p className="text-sm font-medium text-slate-900">{profile.name}</p>
            <p className="text-xs text-slate-500">
              Tentang Tanda Tangan Elektronik
            </p>
          </div>
        </header>

        <article className="space-y-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <section>
            <h1 className="text-2xl font-semibold text-slate-900">
              Tanda Tangan Elektronik {profile.name}
            </h1>
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-semibold">TTE Tidak Tersertifikasi</p>
              <p className="mt-1">
                Layanan ini menggunakan tanda tangan elektronik tidak
                tersertifikasi untuk autentikasi internal dan verifikasi
                integritas dokumen melalui domain resmi instansi, bukan tanda
                tangan elektronik tersertifikasi dari Penyelenggara Sertifikasi
                Elektronik.
              </p>
            </div>
            <p className="mt-2 text-slate-700">
              Dokumen yang Anda terima dari {profile.name} dapat ditandatangani
              secara elektronik. Setiap dokumen ber-QR yang sah akan memuat
              informasi yang dapat diverifikasi langsung di domain resmi
              instansi.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-slate-900">
              Cara memverifikasi dokumen
            </h2>
            <ol className="ml-5 list-decimal space-y-2 text-slate-700">
              <li>Pindai QR pada dokumen menggunakan kamera handphone.</li>
              <li>
                Browser akan membuka halaman di domain{" "}
                <strong>{verifyHost}</strong>. Pastikan domain di address bar
                memang domain resmi {profile.name}.
              </li>
              <li>
                Periksa indikator status di bagian atas halaman:
                <ul className="ml-5 mt-2 list-disc space-y-1">
                  <li>
                    <strong className="text-emerald-700">Signature valid</strong>{" "}
                    — dokumen sah dan datanya cocok dengan record.
                  </li>
                  <li>
                    <strong className="text-red-700">Signature revoked</strong>{" "}
                    — tanda tangan telah dicabut, dokumen tidak berlaku lagi.
                  </li>
                  <li>
                    <strong className="text-amber-700">
                      Integrity check failed
                    </strong>{" "}
                    — ada perubahan setelah ditandatangani. Curigai dokumen
                    palsu.
                  </li>
                  <li>
                    <strong className="text-slate-700">Not found</strong> — QR
                    tidak cocok dengan record manapun. Kemungkinan palsu.
                  </li>
                </ul>
              </li>
              <li>
                Cocokkan nomor surat, perihal, dan nama penandatangan di
                halaman verifikasi dengan yang tertulis di dokumen fisik.
              </li>
            </ol>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">
              Status hukum &amp; batasan
            </h2>
            <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p>
                Sistem ini menerapkan{" "}
                <strong>Tanda Tangan Elektronik Tidak Tersertifikasi</strong>{" "}
                sesuai UU ITE No. 11/2008 jo. UU No. 19/2016 dan PP PSTE No.
                71/2019 tentang Penyelenggaraan Sistem dan Transaksi Elektronik.
              </p>
              <p>
                Ini <strong>bukan</strong> TTE Tersertifikasi yang dikeluarkan
                Penyelenggara Sertifikasi Elektronik (PSrE) terdaftar Kominfo
                seperti BSrE, Privy, Vida, PERURI CA, atau Digisign. Tidak ada
                sertifikat digital X.509 dari otoritas terdaftar — verifikasi
                mengandalkan integritas server {profile.name} dan domain resmi.
              </p>
              <p>
                Kekuatan pembuktian TTE Tidak Tersertifikasi lebih lemah
                dibanding TTE Tersertifikasi. Cocok untuk surat administratif
                internal kampus / instansi, <strong>bukan</strong> untuk
                dokumen yang membutuhkan kekuatan hukum tertinggi (mis. akta
                notaris, dokumen perbankan formal, kontrak bermaterai tinggi).
              </p>
              <p>
                Untuk dokumen berbobot hukum tinggi, gunakan TTE Tersertifikasi
                melalui PSrE resmi.
              </p>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-slate-900">
              Mengapa ini bisa dipercaya?
            </h2>
            <ul className="ml-5 list-disc space-y-2 text-slate-700">
              <li>
                <strong>Domain resmi.</strong> Halaman verifikasi dijalankan
                di <strong>{verifyHost}</strong> — domain resmi instansi.
                Pemalsu tidak bisa membuat halaman di domain ini.
              </li>
              <li>
                <strong>Integritas terjaga.</strong> Setiap tanda tangan
                memuat HMAC-SHA256 yang mengunci nomor surat, perihal,
                tanggal, nama, dan jabatan. Perubahan satu karakter saja
                membuat sistem menampilkan status <em>Integrity check failed</em>.
              </li>
              <li>
                <strong>Bisa dicabut.</strong> Bila ada kesalahan administratif
                atau penyalahgunaan, admin dapat mencabut tanda tangan.
                Pemindaian QR setelah pencabutan akan menampilkan status{" "}
                <em>Signature revoked</em>.
              </li>
              <li>
                <strong>Tercatat lengkap.</strong> Semua aktivitas (pembuatan,
                penandatanganan, pencabutan) tercatat di audit log internal.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-slate-900">
              Apa yang sebaiknya saya lakukan jika ragu?
            </h2>
            <ul className="ml-5 list-disc space-y-1 text-slate-700">
              <li>
                Hubungi langsung {profile.name}
                {profile.website ? (
                  <>
                    {" "}
                    melalui{" "}
                    <Link
                      href={profile.website}
                      className="underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {profile.website.replace(/^https?:\/\//, "")}
                    </Link>
                  </>
                ) : (
                  ""
                )}
                .
              </li>
              <li>
                Pastikan address bar browser benar-benar di domain resmi —
                bukan domain mirip yang menyalin tampilan.
              </li>
              <li>
                Jangan langsung percaya dokumen hanya karena ada QR; selalu
                pindai dan periksa hasil verifikasi.
              </li>
            </ul>
          </section>
        </article>

        <footer className="mt-6 text-center text-xs text-slate-500">
          {profile.website ? (
            <Link href={profile.website} className="hover:underline">
              {profile.website}
            </Link>
          ) : null}
          <p className="mt-2">
            Halaman informasi resmi {profile.name}.
          </p>
        </footer>
      </div>
    </main>
  );
}
