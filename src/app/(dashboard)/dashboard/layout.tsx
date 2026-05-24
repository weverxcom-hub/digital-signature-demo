import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateOrganizationProfile } from "@/lib/profile";
import { LogoMark } from "@/components/LogoMark";
import { SignOutButton } from "./SignOutButton";
import { DashboardNav } from "./DashboardNav";

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
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <LogoMark profile={profile} size={36} rounded="md" />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-semibold">{profile.name}</p>
              <p className="text-xs text-slate-500">Digital Signature</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3 text-sm">
            <span className="hidden max-w-[180px] truncate text-slate-600 md:inline">
              {session.user.name || session.user.email}
            </span>
            <SignOutButton />
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <DashboardNav items={nav} />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
        {children}
      </main>
      <footer className="border-t border-slate-200 px-4 py-4 text-center text-xs text-slate-500 sm:px-6">
        Signed in as{" "}
        <span className="break-all">{session.user.email}</span> · role:{" "}
        {session.user.role}
      </footer>
    </div>
  );
}
