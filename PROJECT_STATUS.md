# Project Status & Handoff (demo distribution)

> **Living handoff doc.** Read this top-to-bottom before continuing work on
> this repo. Update the "Latest update" section + relevant subsections any
> time you ship a meaningful change.

**Latest update**: 2026-05-24 — Demo distribution fully populated with the same feature set as the upstream UNIGA tenant. SVG hardening, Vitest suite, Sentry integration, and full source forward-ported with generic branding.

This is the **open-source, brandable distribution** of the [Digital Signature platform](https://github.com/weverxcom-hub/digital-signature). The upstream production repo is `weverxcom-hub/digital-signature` (deployed at https://sign.unigamalang.ac.id). This demo repo strips UNIGA-specific defaults so any organization can fork and deploy their own copy via the "Deploy to Vercel" button in the README.

---

## 1. Relationship to upstream

| | Upstream (`digital-signature`) | This repo (`digital-signature-demo`) |
|---|---|---|
| Purpose | Production tenant for Universitas Gajayana Malang | Generic distribution for other orgs |
| Default branding | UNIGA logo, name, colors | Acme Foundation / ACME / your-org.example.com |
| Deployment | Vercel project `digital-signature` → `sign.unigamalang.ac.id` | None yet (template repo). Anyone can click Deploy-to-Vercel in README |
| README | Minimal | Rich, with deploy steps + features |
| Source code | Same | Same (forward-ported) |

**Forward-porting strategy.** When upstream ships a feature, mirror it here with branding stripped. Currently in sync as of 2026-05-24.

## 2. Tech stack

Identical to upstream:

- Next.js 14.2.35 (App Router)
- TypeScript 5, React 18
- PostgreSQL via Prisma 6
- NextAuth 4 (credentials, bcrypt cost=12)
- `pdf-lib`, `sharp`, `qrcode`
- `@upstash/ratelimit` (optional, fail-open)
- `@sentry/nextjs` (optional, no-op when DSN unset)
- Vitest 4 (50 tests)
- Tailwind CSS

## 3. What's included

### Features

- **HMAC-SHA256 signature integrity** with constant-time verification
- **Multi-signer support** via `ArchiveRequiredSignatory` join table; archive status reflects required-set completion
- **Soft-deletable signatories** — historical signatures stay valid after roster removal
- **BSrE-style stamp visualization** (QR + name + position + unit + institution footer) rendered server-side via `sharp` from SVG
- **QR with center logo** — error correction `H` + organization logo composited
- **Upload PDF + auto-embed stamp** at chosen page/corner via `pdf-lib`; PDF is **not stored** server-side, just streamed back
- **Brandable** — organization profile (name, logo bytes OR url, primary color, verifyBaseUrl) editable from dashboard
- **Audit log** for every mutation
- **Rate limiting** (optional, Upstash Redis sliding-window):
  - Login: 10/min/IP
  - Sign: 30/min/user
  - PDF embed: 10/min/user
  - Logo upload: 20/min/user
  - Verify API: 120/min/IP
  - Fail-open when Upstash env vars not set
- **Error tracking** (optional, Sentry) — server + edge + client + replay; no-op without `SENTRY_DSN`
- **SVG-safe logo upload** — XSS hardened (script/event-handler/XXE rejected at upload + strict CSP at serve time)
- **Race-condition guards** — partial unique index on active signatures (P2002 catch); Serializable transaction on `/setup` super-admin creation
- **Security headers** globally (HSTS, CSP `frame-ancestors 'none'` on `/verify/*`, X-Frame-Options, Permissions-Policy, etc.)
- **Test suite** — 50 Vitest unit tests covering HMAC golden vectors + status matrix + rate-limit semantics + stamp glyph regression

### Tests passing

```
Test Files  4 passed (4)
     Tests  50 passed (50)
   Start at  ~now
   Duration  ~1000ms
```

## 4. Quick deploy

### Option A: Deploy-to-Vercel button (recommended for evaluation)

Click the button in the README. Vercel will:
1. Fork this repo into your GitHub org
2. Prompt you for the required env vars
3. Build + deploy

### Option B: Manual

```bash
git clone https://github.com/weverxcom-hub/digital-signature-demo.git
cd digital-signature-demo
npm install
cp .env.example .env
# Edit .env — see "Env vars" section below
npx prisma migrate deploy
npm run dev
# → http://localhost:3000
# → /setup to create the first super-admin
```

## 5. Env vars

See `.env.example` for the full list with inline docs.

| Var | Required? | Used for |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection. Recommend [Neon](https://neon.tech) (free tier, serverless-friendly) |
| `NEXTAUTH_URL` | yes | NextAuth callback origin (your deployed URL) |
| `NEXTAUTH_SECRET` | yes | NextAuth JWT signing — `openssl rand -base64 32` |
| `SIGNATURE_SECRET` | **yes** | HMAC secret for signature integrity. **Must differ from `NEXTAUTH_SECRET`.** **Never rotate** — rotation invalidates every existing signature. |
| `NEXT_PUBLIC_APP_URL` | yes | Default QR target |
| `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | optional | Rate limit storage. Fail-open without these. |
| `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN` | optional | Error tracking. No-op without these. |

## 6. Architecture

Same as upstream. Key files (mirror of `digital-signature`):

```
prisma/schema.prisma                       # 7 models: User, OrganizationProfile, Signatory, Archive, ArchiveRequiredSignatory, ArchiveSignature, AuditLog
prisma/migrations/                         # 7 additive migrations
src/app/                                   # Next.js App Router pages + API
src/lib/signature.ts                       # HMAC engine
src/lib/archiveSignature.ts                # Status derivation (DRAFT/PENDING/FULLY_SIGNED/REVOKED)
src/lib/rateLimit.ts                       # Upstash limiters
src/lib/stamp.ts + stampFont.ts            # Stamp SVG composition + per-glyph Inter font fallback
src/lib/qr.ts                              # QR code with center logo
src/lib/__tests__/                         # 50 Vitest tests
sentry.{server,edge,client}.config.ts      # Sentry runtime init (no-op when DSN unset)
next.config.mjs                            # Security headers + Sentry wrapper
.env.example                               # All env vars documented
docs/PANDUAN.md                            # End-user guide (Indonesian; re-translate for your org)
public/fonts/Inter-Regular.ttf, -Bold.ttf  # Bundled fonts for stamp rendering (anti-tofu)
README.md                                  # User-facing docs + Deploy-to-Vercel button
PROJECT_STATUS.md                          # This file
```

For full per-file walkthrough, schema details, route table, and security posture, see the upstream's [PROJECT_STATUS.md](https://github.com/weverxcom-hub/digital-signature/blob/main/PROJECT_STATUS.md) — every section applies here verbatim except branding-specific bits.

## 7. Branding checklist (after forking)

The default branding is "Acme Foundation" / "ACME" / `your-org.example.com`. To brand for your org:

1. **Dashboard → Profile** (after first login):
   - Set organization name + short name
   - Upload your logo (PNG/JPG/SVG ≤2MB)
   - Set primary color (hex, default `#0f766e`)
   - Set `verifyBaseUrl` to your deployed domain (e.g. `https://sign.your-org.example.com`)
2. **`docs/PANDUAN.md`** — re-translate or replace if your org's primary language is not Indonesian
3. **Optional: replace `public/favicon.ico`** with your org's favicon
4. **Optional: edit `src/app/page.tsx`** to customize the landing page copy beyond what's drivable from `OrganizationProfile`

## 8. Open items / TODO

### For maintainers (i.e. weverxcom-hub)

- [ ] **Add this repo to the Devin GitHub App installation** (https://github.com/settings/installations → Devin AI → Configure) so future automated updates can `git push` normally. Currently the workaround is GitHub Git Data API.
- [ ] **Deploy a public demo instance** linked from the README so prospective adopters can see a working version before forking.

### For adopters (i.e. forks)

- [ ] Replace the default `SUPER_ADMIN` after first `/setup`
- [ ] Set up Upstash Redis (free tier, ~10K commands/day) to enable rate limiting
- [ ] Set up Sentry (free tier, 5K events/month) to track production errors
- [ ] Set up Neon Postgres (free tier) with point-in-time recovery on paid plans for backup

## 9. Running locally

```bash
npm install                  # postinstall runs prisma generate
docker run -d --name dsig-pg \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=digital_signature \
  -p 55432:5432 \
  postgres:16-alpine
cp .env.example .env
# edit .env — set NEXTAUTH_SECRET + SIGNATURE_SECRET (different values!)
npx prisma migrate deploy
npm run dev                   # → http://localhost:3000
```

Daily workflow:
```bash
npm run lint
npm run typecheck
npm test                      # 50 Vitest tests
```

## 10. License

MIT. See `LICENSE`.

---

**Maintainer note**: Forward-port from upstream by cherry-picking branding-neutral commits, then s/UNIGA/Acme Foundation/g (and similar). Avoid copying any UNIGA-specific config (`verifyBaseUrl` defaults, hardcoded logo URLs, etc.).
