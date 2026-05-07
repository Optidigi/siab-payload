import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ForgotPasswordForm } from "@/components/forms/ForgotPasswordForm"

export default function Page() {
  return (
    <main className="flex min-h-[min(100vh,100dvh)] items-start sm:items-center justify-center px-4 pt-12 sm:pt-0 sm:p-6 pb-[env(safe-area-inset-bottom)]">
      <Card className="w-full max-w-sm">
        <CardHeader><CardTitle>Reset your password</CardTitle></CardHeader>
        <CardContent><ForgotPasswordForm /></CardContent>
      </Card>
    </main>
  )
}
