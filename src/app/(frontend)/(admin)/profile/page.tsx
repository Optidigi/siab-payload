import { requireAuth } from "@/lib/authGate"
import { ProfileForm } from "@/components/forms/ProfileForm"

export default async function ProfilePage() {
  const { user } = await requireAuth()
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Profile</h1>
      <ProfileForm user={user} />
    </div>
  )
}
