import { getOrCreateOrganizationProfile } from "@/lib/profile";
import { ProfileForm } from "./ProfileForm";

export const metadata = { title: "Organization profile" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const profile = await getOrCreateOrganizationProfile();
  return (
    <ProfileForm
      initial={{
        name: profile.name,
        shortName: profile.shortName,
        tagline: profile.tagline,
        address: profile.address,
        website: profile.website,
        logoUrl: profile.logoUrl,
        primaryColor: profile.primaryColor,
        verifyBaseUrl: profile.verifyBaseUrl,
        logoMimeType: profile.logoMimeType,
        logoUpdatedAt: profile.logoUpdatedAt
          ? profile.logoUpdatedAt.toISOString()
          : null,
      }}
    />
  );
}
