# Panduan Penggunaan — Digital Signature Platform

Panduan ini ditulis dalam Bahasa Indonesia, untuk admin yang akan menggunakan sistem tanda tangan elektronik harian. Halaman ini adalah **sumber resmi panduan** — kalau perlu update, edit file ini lewat tombol "Edit" di pojok kanan atas GitHub, commit, dan otomatis live setelah deploy berikutnya.

## Daftar isi

1. [Konsep singkat](#konsep-singkat)
2. [Alur lengkap (visual)](#alur-lengkap-visual)
3. [Step 1 — Konfigurasi organisasi](#step-1--konfigurasi-organisasi)
4. [Step 2 — Daftarkan penandatangan](#step-2--daftarkan-penandatangan)
5. [Step 3 — Buat archive (catat surat)](#step-3--buat-archive-catat-surat)
6. [Step 4 — Tandatangani](#step-4--tandatangani)
7. [Step 5 — Tempel ke dokumen](#step-5--tempel-ke-dokumen)
8. [Status verifikasi](#status-verifikasi)
9. [Setup domain resmi (.ac.id / .com)](#setup-domain-resmi)
10. [Mencabut tanda tangan](#mencabut-tanda-tangan)
11. [FAQ](#faq)

---

## Konsep singkat

Sistem ini menerbitkan **attestasi elektronik** untuk setiap dokumen yang ditandatangani. Setiap tanda tangan menghasilkan:

- **Token UUID acak** — pengenal unik.
- **HMAC-SHA256** — hash kriptografi yang mengunci semua metadata dokumen (nomor surat, perihal, tanggal, nama signatory, jabatan, waktu tanda tangan). Hash ini tidak bisa dipalsukan tanpa mengetahui `SIGNATURE_SECRET` di server.
- **QR Code** — gambar yang berisi URL `https://<verifyBaseUrl>/verify/<token>`. Saat dipindai, browser membuka halaman verifikasi resmi.

Kepercayaan publik datang dari dua hal:

1. **Domain resmi** instansi (`your-org.example.com`, dll.) — pemalsu tidak bisa bikin halaman di sini.
2. **HMAC integrity** — kalau database di-tampering, halaman verifikasi langsung menampilkan status `Integrity check failed`.

---

## Alur lengkap (visual)

```
[Admin login] → /dashboard
       ↓
[Profile org]    set logo, brand color, dan verifyBaseUrl (domain resmi)
       ↓
[Signatories]    daftarkan Rektor, Dekan, dll. (sekali setup)
       ↓
[Archives]       input: nomor surat, perihal, tanggal terbit
       ↓
[Sign]           pilih signatory → sistem buat:
                    • token unik (UUID)
                    • HMAC-SHA256 attestation
                    • URL QR: https://<verifyBaseUrl>/verify/<token>
       ↓
[Download QR]    admin paste visualisasi tanda tangan ke PDF/DOCX
       ↓
[Surat dikirim]
       ↓
[Penerima scan QR] → diarahkan ke verifyBaseUrl (domain resmi)
       ↓
[Halaman verifikasi publik]
       menampilkan:
        • Logo + nama instansi
        • Status: Valid / Tampered / Revoked / Not found
        • Nomor surat, perihal, tanggal terbit
        • Nama + jabatan penandatangan
        • Tanggal-jam ditandatangani digital
```

---

## Step 1 — Konfigurasi organisasi

Buka dashboard, klik **Organization Profile**, isi:

| Field | Deskripsi | Contoh |
| --- | --- | --- |
| **Name** | Nama lengkap instansi (tampil di header verify) | `Acme Foundation` |
| **Short name** | Singkatan untuk header dashboard | `ACME` |
| **Logo URL** | URL langsung file PNG/SVG logo, di-host publik | `https://cdn.example.com/logo.png` |
| **Primary color** | Warna brand di header verify | `#0f766e` |
| **Verify base URL** | Domain resmi tempat QR akan mengarah | `https://your-org.example.com` |
| **Website** | Link ke website instansi (footer verify) | `https://example.com` |
| **Tagline** | Tagline di home page (opsional) | `Tanda Tangan Elektronik Resmi` |

> **Penting:** setelah ganti `verifyBaseUrl`, pastikan domain itu sudah meneruskan path `/verify/<token>` ke aplikasi ini (lihat [Setup domain resmi](#setup-domain-resmi)).

---

## Step 2 — Daftarkan penandatangan

Di **Signatories**, klik **Add signatory**:

| Field | Deskripsi | Contoh |
| --- | --- | --- |
| **Name** | Nama lengkap dengan gelar | `Dr. Ir. Sutopo, M.Si` |
| **Position** | Jabatan (tampil di QR & verify) | `Direktur Eksekutif` |
| **Unit** | Unit/instansi (opsional) | `Acme Foundation` |
| **NIP** | NIP/identitas (opsional, internal) | `196801011990031001` |

**Soft delete.** Saat signatory dihapus, sistem hanya menandainya non-aktif. Tanda tangan yang sudah dibuat dengan nama/jabatan itu **tetap valid** karena nama dan jabatan dibekukan ke record tanda tangan saat penandatanganan.

---

## Step 3 — Buat archive (catat surat)

Di **Archives**, klik **New archive**:

| Field | Deskripsi | Contoh |
| --- | --- | --- |
| **Number** | Nomor surat | `001/ORG/DIR/V/2026` |
| **Subject** | Perihal singkat | `Pengumuman Libur Semester Genap` |
| **Description** | Opsional, ringkasan isi (tampil di verify) | `Libur 1-14 Juli 2026...` |
| **Issued at** | Tanggal terbit | `2026-05-12` |

Selama belum ditandatangani, archive **bisa diedit**. Setelah ditandatangani, metadata **terkunci** — kalau ada kesalahan, cabut tanda tangan dulu, edit, lalu tandatangani ulang.

---

## Step 4 — Tandatangani

Di detail archive:

1. Pilih signatory dari dropdown.
2. Klik **Sign archive**.
3. Sistem membuat token + HMAC + QR code di belakang layar.

**Yang terjadi:**

```
1. Generate token = uuid()
2. now = Date.now()
3. payload = (archiveId | number | subject | issuedAt | signatoryId
              | signatoryName | signatoryPosition | now | token)
4. hmac = HMAC-SHA256(payload, SIGNATURE_SECRET)
5. simpan ArchiveSignature{ token, hmac, signedAt: now,
                            signatoryName, signatoryPosition, signatoryUnit }
6. URL verify = verifyBaseUrl + "/verify/" + token
```

Snapshot nama + jabatan signatory dibekukan ke record tanda tangan — bukan reference live — jadi kalau signatory di-update kemudian, dokumen lama tetap menampilkan nama/jabatan saat itu.

---

## Step 5 — Tempel ke dokumen

Di detail archive yang sudah ditandatangani, ada dua opsi unduhan:

### A. Visualisasi tanda tangan (rekomendasi)

Card **Visualisasi tanda tangan** → tombol **Download visualisasi (PNG)**. Outputnya komposit QR + teks "Ditandatangani secara elektronik oleh:" + jabatan + nama, dengan bingkai dan italic disclaimer. Tinggal copy-paste ke Word/PDF di tempat tanda tangan basah biasanya berada.

Layout PNG:

```
┌──────────────────────────────────────────────────┐
│  ┌──────────┐  Ditandatangani secara elektronik  │
│  │          │  oleh:                              │
│  │   QR     │                                     │
│  │  Code    │  DIREKTUR EKSEKUTIF                 │
│  │          │  Acme Foundation                    │
│  └──────────┘                                     │
│                Dr. Ir. Sutopo, M.Si               │
└──────────────────────────────────────────────────┘
  Dokumen ini ditandatangani secara elektronik oleh
  Acme Foundation. Pindai QR untuk
  verifikasi di your-org.example.com.
```

### B. QR saja (PNG / SVG)

Kalau kamu mau atur layout teks-nya sendiri di template surat: tombol **Download QR (PNG)** atau **Download QR (SVG)**.

Setelah ditempel, simpan ke PDF dan kirim seperti biasa.

---

## Status verifikasi

Saat penerima scan QR, halaman verifikasi menampilkan salah satu status:

| Status | Arti | Tindakan penerima |
| --- | --- | --- |
| ✅ **Signature valid** | Semua metadata cocok dengan record & HMAC | Dokumen sah |
| ❌ **Signature revoked** | Admin telah mencabut tanda tangan | Dokumen tidak berlaku lagi |
| ⚠️ **Integrity check failed** | Ada field yang berubah setelah ditandatangani | Curigai dokumen palsu, hubungi instansi |
| ⚪ **Not found** | Token tidak cocok dengan record manapun | QR palsu atau record sudah dihapus |

---

## Setup domain resmi

Trust dari penerima surat naik signifikan kalau QR mengarah ke domain resmi instansi. Pilih salah satu:

### Opsi A — Subdomain di Vercel (paling simpel)

1. Buat DNS record di registrar/DNS provider domain kamu:
   - **CNAME** `tte` → `cname.vercel-dns.com.`
   - (kalau Vercel minta verifikasi domain) **TXT** `_vercel` → `vc-domain-verify=tte.<domain>,<token>`
2. Di Vercel Dashboard → project `digital-signature` → Settings → Domains → Add `tte.<your-domain>`.
3. Update env var Vercel: `NEXTAUTH_URL` dan `NEXT_PUBLIC_APP_URL` ke `https://tte.<your-domain>`.
4. Redeploy.
5. Set **Verify base URL** di `/dashboard/profile` ke `https://tte.<your-domain>`.

Setelah ini, semua URL (dashboard + verify) jalan di domain resmi kamu.

### Opsi B — Reverse-proxy path (kalau domain utama sudah dipakai website lain)

1. Configure reverse proxy (Nginx/Cloudflare Worker) yang forward `<your-domain>/verify/*` ke aplikasi Vercel.
2. Set **Verify base URL** di profil organisasi ke `https://<your-domain>`. Dashboard tetap diakses di domain Vercel; hanya halaman verifikasi yang di-domain resmi.

---

## Mencabut tanda tangan

Bila ada kesalahan administratif (mis. nomor surat salah) atau penyalahgunaan:

1. Buka detail archive di dashboard.
2. Isi field **Reason** di section "Revoke signature".
3. Klik **Revoke signature**. Hanya role `SUPER_ADMIN` yang bisa.

Setelah itu, pemindaian QR akan menampilkan status `Signature revoked` dengan alasan + tanggal pencabutan.

> Catatan: archive yang sudah dicabut **tidak bisa di-undo**. Kalau perlu ulang, tandatangani ulang archive (akan dapat token + QR baru).

---

## FAQ

**Apa bedanya dengan BSrE (Balai Sertifikasi Elektronik)?**
BSrE menerbitkan sertifikat X.509 yang mengikat identitas ke kunci privat (standar PKI). Sistem ini lebih ringan — tanda tangan dijamin oleh kombinasi **(domain resmi instansi + HMAC server-side)**. Cocok untuk surat internal/eksternal yang kepercayaannya berbasis "domain resmi instansi". Bisa diupgrade ke PKI di kemudian hari karena verify endpoint sudah mengembalikan JSON terstruktur.

**Apa yang terjadi kalau QR dipalsukan (orang generate QR sendiri)?**
QR palsu akan menampilkan status **Not found** atau **Integrity check failed**, karena hanya server kami yang tahu `SIGNATURE_SECRET`. Tidak ada cara membuat QR yang lolos verifikasi tanpa akses server.

**Apa yang terjadi kalau database di-tampering langsung?**
HMAC mengunci kombinasi metadata. Mengubah nomor surat, perihal, tanggal, nama, atau jabatan setelah ditandatangani membuat halaman verifikasi menampilkan **Integrity check failed**. Server tidak menyimpan HMAC yang sudah dihitung tanpa nilai aslinya — kalau ada yang ngubah satu field, hash-nya gak match lagi.

**Bisakah dokumen lama tetap valid kalau signatory pensiun?**
Bisa. Nama dan jabatan dibekukan ke record tanda tangan saat penandatanganan. Walau signatory di-soft-delete, dokumen lama tetap menampilkan informasi yang sama saat itu.

**Bisakah satu archive ditandatangani oleh lebih dari satu signatory?**
Saat ini tidak — satu archive = satu signatory. Kalau perlu multi-signer (mis. Rektor + Wakil Rektor), buat archive terpisah atau request fitur.

**Apa itu `SIGNATURE_SECRET`?**
Random secret 32-byte yang disimpan di env var server. Dipakai sebagai kunci HMAC. **Jangan pernah** di-leak. Kalau bocor, semua tanda tangan harus di-revoke dan diregenerate dengan secret baru.

**Bagaimana cara backup data?**
Database Postgres (Neon) sudah point-in-time recovery selama 7 hari di tier gratis. Untuk backup manual: `pg_dump $DATABASE_URL > backup.sql`.

---

## Bantuan & kontak

- Issue/bug: buka issue di [GitHub repo](https://github.com/weverxcom-hub/digital-signature-demo/issues).
- Update panduan ini: edit `docs/PANDUAN.md` langsung di GitHub web editor.
- Source code: [github.com/weverxcom-hub/digital-signature-demo](https://github.com/weverxcom-hub/digital-signature-demo).
