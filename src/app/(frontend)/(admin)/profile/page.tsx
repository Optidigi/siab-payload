import { requireAuth } from "@/lib/authGate"
import { ProfileForm } from "@/components/forms/ProfileForm"
import { PageHeader } from "@/components/page-header"

export default async function ProfilePage() {
  const { user } = await requireAuth()
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Profile" />
      <ProfileForm user={user} />
    </div>
  )
}
