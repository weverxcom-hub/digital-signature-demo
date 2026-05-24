// Quick smoke test for stamp.ts + qr.ts after the font fix.
// Run with: npx tsx scripts/smoke-stamp.ts
import fs from "node:fs";
import { renderSignatureStamp } from "../src/lib/stamp";
import { renderQrPng } from "../src/lib/qr";

async function main() {
  // Render a stamp with no logo.
  const stamp1 = await renderSignatureStamp({
    verifyUrl: "https://sign.example.com/verify/test-token",
    signatoryName: "Dr. Adit Saputra, M.Sc.",
    signatoryPosition: "Wakil Rektor Bidang Akademik & Kemahasiswaan",
    signatoryUnit: "Acme Foundation",
    organizationName: "Acme Foundation",
    footerLine1: "This document is electronically signed by Acme Foundation.",
    footerLine2: "Pindai QR untuk verifikasi di sign.example.com.",
  });
  fs.writeFileSync("/tmp/stamp-no-logo.png", stamp1);
  console.log("stamp-no-logo.png:", stamp1.byteLength, "bytes");

  // Render a stamp with a small placeholder logo to check compositing.
  const logoBytes = fs.readFileSync("/tmp/uni-logo.png");
  const stamp2 = await renderSignatureStamp({
    verifyUrl: "https://sign.example.com/verify/test-token-with-logo",
    signatoryName: "Dr. Adit Saputra, M.Sc.",
    signatoryPosition: "Wakil Rektor",
    signatoryUnit: "Acme Foundation",
    organizationName: "Acme Foundation",
    footerLine1: "Dokumen ini ditandatangani secara elektronik.",
    footerLine2: "Pindai QR untuk verifikasi.",
    qrLogo: { bytes: logoBytes, mimeType: "image/png" },
  });
  fs.writeFileSync("/tmp/stamp-with-logo.png", stamp2);
  console.log("stamp-with-logo.png:", stamp2.byteLength, "bytes");

  // Plain QR with logo.
  const qr = await renderQrPng({
    url: "https://sign.example.com/verify/abc",
    size: 320,
    logo: { bytes: logoBytes, mimeType: "image/png" },
  });
  fs.writeFileSync("/tmp/qr-with-logo.png", qr);
  console.log("qr-with-logo.png:", qr.byteLength, "bytes");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
