"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string };

export function DashboardNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav
      className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 pt-1 text-sm scrollbar-thin"
      aria-label="Dashboard sections"
    >
      {items.map((item) => {
        // Highlight the link when the user is on its page or anywhere
        // under it (e.g. /dashboard/archives/123 still highlights
        // "Archives"). "Overview" only matches the exact path so it
        // doesn't stay highlighted while inside a sub-section.
        const isOverview = item.href === "/dashboard";
        const active = isOverview
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "whitespace-nowrap rounded-md px-3 py-1.5 transition",
              active
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-700 hover:bg-slate-100"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
