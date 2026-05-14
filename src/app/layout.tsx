import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { getOrCreateOrganizationProfile } from "@/lib/profile";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export async function generateMetadata(): Promise<Metadata> {
  try {
    const profile = await getOrCreateOrganizationProfile();
    return {
      title: {
        default: `${profile.name} — Digital Signature`,
        template: `%s — ${profile.shortName || profile.name}`,
      },
      description:
        profile.tagline ||
        "Digital signature attestation & verification platform.",
    };
  } catch {
    return {
      title: "Digital Signature",
      description: "Digital signature attestation & verification platform.",
    };
  }
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  let primaryColor = "#0f766e";
  try {
    const profile = await getOrCreateOrganizationProfile();
    primaryColor = profile.primaryColor || primaryColor;
  } catch {
    // Database may not be available at build time. Fall back to default brand color.
  }
  return (
    <html lang="en">
      <body
        className={`${inter.variable} font-sans bg-slate-50 text-slate-900 antialiased`}
        style={{ ["--brand" as string]: primaryColor }}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
