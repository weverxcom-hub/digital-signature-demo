import { getOrCreateOrganizationProfile } from "@/lib/profile";
import { ProfileForm } from "./ProfileForm";

export const metadata = { title: "Organization profile" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const profile = await getOrCreateOrganizationProfile();
  return <ProfileForm initial={profile} />;
}
