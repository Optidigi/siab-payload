import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ResetPasswordForm } from "@/components/forms/ResetPasswordForm"

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader><CardTitle>Set a new password</CardTitle></CardHeader>
        <CardContent><ResetPasswordForm token={token} /></CardContent>
      </Card>
    </main>
  )
}
