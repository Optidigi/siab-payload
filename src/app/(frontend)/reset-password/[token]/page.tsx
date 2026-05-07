import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ResetPasswordForm } from "@/components/forms/ResetPasswordForm"

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return (
    <main className="flex min-h-[min(100vh,100dvh)] items-start sm:items-center justify-center px-4 pt-12 sm:pt-0 sm:p-6 pb-[env(safe-area-inset-bottom)]">
      <Card className="w-full max-w-sm">
        <CardHeader><CardTitle>Set a new password</CardTitle></CardHeader>
        <CardContent><ResetPasswordForm token={token} /></CardContent>
      </Card>
    </main>
  )
}
