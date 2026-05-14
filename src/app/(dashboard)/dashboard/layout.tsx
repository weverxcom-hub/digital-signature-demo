import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import Image from "next/image";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { getOrCreateOrganizationProfile } from "@/lib/profile";
import { SignOutButton } from "./SignOutButton";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const profile = await getOrCreateOrganizationProfile();

  const nav = [
    { href: "/dashboard", label: "Overview" },
    { href: "/dashboard/archives", label: "Archives" },
    { href: "/dashboard/signatories", label: "Signatories" },
    { href: "/dashboard/profile", label: "Organization Profile" },
    { href: "/dashboard/audit", label: "Audit Log" },
    { href: "/dashboard/help", label: "Panduan" },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            {profile.logoUrl ? (
              <Image
                src={profile.logoUrl}
                alt={profile.name}
                width={36}
                height={36}
                className="h-9 w-9 rounded object-contain"
                unoptimized
              />
            ) : (
              <div
                className="flex h-9 w-9 items-center justify-center rounded text-sm font-semibold text-white"
                style={{ backgroundColor: "var(--brand)" }}
              >
                {(profile.shortName?.slice(0, 2) || profile.name.slice(0, 2)).toUpperCase()}
              </div>
            )}
            <div className="leading-tight">
              <p className="text-sm font-semibold">{profile.name}</p>
              <p className="text-xs text-slate-500">Digital Signature</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-slate-600 sm:inline">
              {session.user.name || session.user.email}
            </span>
            <SignOutButton />
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2 pt-1 text-sm">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded px-3 py-1.5 text-slate-700 hover:bg-slate-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-6">{children}</main>
      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        Signed in as {session.user.email} · role: {session.user.role}
      </footer>
    </div>
  );
}
