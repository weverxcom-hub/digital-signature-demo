import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getOrCreateOrganizationProfile } from "@/lib/profile";
import { LogoMark } from "@/components/LogoMark";
import { Button } from "@/components/ui/Button";

export default async function HomePage() {
  const userCount = await prisma.user.count();
  if (userCount === 0) {
    redirect("/setup");
  }
  const profile = await getOrCreateOrganizationProfile();

  return (
    <main className="min-h-screen">
      <section
        className="relative overflow-hidden text-white"
        style={{
          background: `linear-gradient(135deg, ${profile.primaryColor}, #0b1220)`,
        }}
      >
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-20">
          <div className="flex items-center gap-4">
            <LogoMark
              profile={profile}
              size={56}
              className="bg-white p-1"
              fallbackBg="rgba(255,255,255,0.15)"
            />
            <div>
              <p className="text-sm uppercase tracking-wide opacity-80">
                {profile.shortName || "Digital Signature"}
              </p>
              <h1 className="text-xl font-semibold">{profile.name}</h1>
            </div>
          </div>

          <h2 className="mt-10 max-w-2xl text-balance text-3xl font-bold leading-tight sm:mt-12 sm:text-4xl">
            Sign your documents digitally,{" "}
            <span className="opacity-80">verify them publicly.</span>
          </h2>
          <p className="mt-4 max-w-2xl text-lg text-white/85">
            {profile.tagline ||
              "Issue documents with tamper-evident attestations. Each signed document gets a unique QR code that points to a public verification page on your official domain."}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/login">
              <Button size="lg" variant="secondary">
                Sign in to dashboard
              </Button>
            </Link>
            <Link href="/about">
              <Button size="lg" variant="outline" className="border-white/40 bg-transparent text-white hover:bg-white/10">
                Tentang sistem
              </Button>
            </Link>
            <Link href="#how-it-works">
              <Button size="lg" variant="ghost" className="text-white hover:bg-white/10">
                How it works
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section
        id="how-it-works"
        className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16"
      >
        <h3 className="text-2xl font-semibold">How verification works</h3>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          <Step
            n="1"
            title="Issue & sign"
            body="Authorized admins pick a signatory and sign an archived document. The system stores a tamper-evident attestation with HMAC integrity."
          />
          <Step
            n="2"
            title="Embed QR"
            body="A QR code is generated for the document. It points to your official verification URL, branded with your organization's identity."
          />
          <Step
            n="3"
            title="Public verify"
            body="Anyone scanning the QR is taken to a public page on your own domain that confirms validity, the signatory's identity, and document details."
          />
        </div>
      </section>

      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-500">
        © {new Date().getFullYear()} {profile.name} — powered by an open-source
        digital signature platform.
      </footer>
    </main>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div
        className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold text-white"
        style={{ backgroundColor: "var(--brand)" }}
      >
        {n}
      </div>
      <h4 className="font-semibold">{title}</h4>
      <p className="mt-1 text-sm text-slate-600">{body}</p>
    </div>
  );
}
