# Digital Signature

> **Self-hosted, single-tenant electronic signature (TTE) platform**
> for institutional documents (SK, surat, sertifikat). Each signed
> document gets a unique QR code that points to a public verification
> page on **your own domain** — the trust anchor stays with you, not
> with a third party.

This repo is the open-source, brandable distribution. Deploy a copy
under your organization's domain in minutes. One deployment = one
organization.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fweverxcom-hub%2Fdigital-signature-demo&env=NEXTAUTH_SECRET,SIGNATURE_SECRET,NEXTAUTH_URL,NEXT_PUBLIC_APP_URL,DATABASE_URL&envDescription=Random%20secrets%20%2B%20a%20Postgres%20DATABASE_URL%20(Neon%20is%20free).&project-name=digital-signature&repository-name=digital-signature)

---

## Features

- **HMAC-SHA256 integrity** — every signature binds the document
  number, subject, signatory identity, archive id, and token. Any
  tampering after signing is detected at the verification page.
- **Public per-token verification** at `/verify/<token>` — anyone
  with the QR can confirm validity without logging in.
- **Multi-signer support** — declare required signers at archive
  creation time; the archive's status reflects whether all required
  signers have signed.
- **Soft-deletable signatories** — historical signatures remain valid
  even after a signatory is removed from the active roster.
- **BSrE-style visualization** — QR + signatory name + position +
  unit + institution footer, rendered server-side via `sharp`.
- **Upload PDF + auto-embed stamp** — admin uploads the original PDF,
  the server stamps it with the QR/visualization at the chosen page
  and corner, and streams the stamped PDF back as a download. No
  document storage on the server.
- **Brandable** — set your organization's name, logo URL, primary
  color, and verification base URL through the dashboard.
- **Audit log** — every mutation (sign, revoke, embed, profile
  update) is recorded with actor + metadata.
- **Rate limiting** (optional) — Upstash Redis sliding-window
  limits on login, signing, PDF embed, logo upload, and verify
  endpoints. Fails open if Upstash env vars are absent.
- **Error tracking** (optional) — Sentry server + edge + client
  SDK + global error boundary. No-op when DSN is absent.
- **SVG-safe logo upload** — uploaded logos served with strict CSP
  + sandbox headers; SVG payloads with scripts/event handlers/XXE
  are rejected at upload time.
- **Test suite** — Vitest unit tests for HMAC golden vectors,
  archive status matrix, rate-limit semantics, and stamp glyph
  regression guard.

## Tech stack

- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- PostgreSQL (Neon is free for getting started) + Prisma 5
- NextAuth credentials (bcryptjs)
- `qrcode`, `sharp`, `pdf-lib`, `opentype.js`
- `@upstash/ratelimit` + `@upstash/redis` (optional, for rate limiting)
- `@sentry/nextjs` (optional, for error tracking)
- `vitest` for unit tests
- Hosting on Vercel (free tier is plenty for an institutional
  deployment)

## Quickstart (Deploy to Vercel)

1. Click the **Deploy with Vercel** button above.
2. Pick a project name and connect a GitHub repo for future updates.
3. Provide environment variables:
   - `DATABASE_URL` — Postgres connection string (e.g. from
     [Neon](https://neon.tech) — free Singapore/EU/US instance).
   - `NEXTAUTH_SECRET` — long random string
     (`openssl rand -base64 32`).
   - `SIGNATURE_SECRET` — another long random string. **Don't
     change this after going live** — it would invalidate all
     existing HMAC signatures.
   - `NEXTAUTH_URL` — full public URL of the deployment
     (e.g. `https://sign.your-org.example.com`).
   - `NEXT_PUBLIC_APP_URL` — same as `NEXTAUTH_URL`, used on the
     client.
4. After deploy, visit `/setup` and create the first admin + your
   organization profile.
5. (Optional) Attach a custom domain in Vercel → Project Settings →
   Domains. Set DNS as instructed. Update `NEXTAUTH_URL` and
   `NEXT_PUBLIC_APP_URL` to the custom domain. The `OrganizationProfile.verifyBaseUrl` field controls where QR codes
   point — set this to your **official institutional domain** for
   maximum trust (see "Trust anchor" below).
6. (Recommended) Add production-grade observability + abuse protection:
   - **Rate limiting** — set `UPSTASH_REDIS_REST_URL` and
     `UPSTASH_REDIS_REST_TOKEN` (free at
     [upstash.com](https://upstash.com)). Without these, the app
     fails open — login, signing, and verification are unrate-limited.
   - **Error tracking** — set `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN`
     (free at [sentry.io](https://sentry.io)). Without these, the
     Sentry SDK is a no-op.

See `.env.example` for the full list of supported variables.

## Local development

```bash
git clone https://github.com/weverxcom-hub/digital-signature-demo.git
cd digital-signature-demo
npm install
cp .env.example .env
# Fill DATABASE_URL, NEXTAUTH_SECRET, SIGNATURE_SECRET.
npx prisma generate
npx prisma migrate deploy
npm run dev
```

Open <http://localhost:3000>.

Verify before committing:

```bash
npm run lint
npm run typecheck
npm run build
```

## Trust anchor

`OrganizationProfile.verifyBaseUrl` controls where QR codes point.
This is the **single most important trust signal** for recipients:
they scan a QR, land on a domain they recognize as belonging to
your institution, and see the verification result. To get this
right you have three options:

1. **Host this app at a subdomain of your official domain** — the
   simplest. e.g. deploy at `sign.your-org.example.com`, set
   `verifyBaseUrl = https://sign.your-org.example.com`.
2. **Reverse-proxy `your-org.example.com/verify/*`** to this app —
   QR codes look like they live at the root of your domain.
3. **Host at the root** — only if this is the only app on that
   domain.

If `verifyBaseUrl` is empty, the app falls back to `NEXT_PUBLIC_APP_URL`. The dashboard will warn you until this is
configured.

## Status & roadmap

The current build covers single- and multi-signer flows, public
verification, BSrE-style stamp visualization, PDF embed, branding,
and audit. It's used in production for at least one organization
(an Indonesian university running off the upstream
`digital-signature` repo).

Planned (open to PRs):

- Multi-tenant SaaS mode (1 deployment, many orgs).
- Webhook integrations with external archive systems.
- Real PKI/BSrE integration (currently HMAC-only).
- Bulk import / export.
- Pagination and search on the archive list.
- Reset password flow.

## License

MIT — see [LICENSE](./LICENSE). You're free to fork this for your
own organization. If you build something on top, a star and a link
back to this repo are appreciated but not required.

## Documentation

The end-user manual (in Bahasa Indonesia) lives in
[`docs/PANDUAN.md`](./docs/PANDUAN.md). The `/dashboard/help`
route inside the app links to it.
