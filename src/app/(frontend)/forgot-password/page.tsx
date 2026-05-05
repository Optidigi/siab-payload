import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ForgotPasswordForm } from "@/components/forms/ForgotPasswordForm"

export default function Page() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader><CardTitle>Reset your password</CardTitle></CardHeader>
        <CardContent><ForgotPasswordForm /></CardContent>
      </Card>
    </main>
  )
}
