import Link from "next/link"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { ForgotPasswordForm } from "@/components/forms/ForgotPasswordForm"

// FN-2026-0044 — pre-fix the page rendered zero <a> elements; users who
// landed here by mistake had only the address bar to escape. Add a
// Back-to-sign-in link in the card footer.
export default function Page() {
  return (
    <main className="flex min-h-[min(100vh,100dvh)] items-start sm:items-center justify-center px-4 pt-12 sm:pt-0 sm:p-6 pb-[env(safe-area-inset-bottom)]">
      <Card className="w-full max-w-sm">
        <CardHeader><CardTitle>Reset your password</CardTitle></CardHeader>
        <CardContent><ForgotPasswordForm /></CardContent>
        <CardFooter className="border-t justify-center text-sm">
          <Link href="/login" className="text-muted-foreground underline">
            Back to sign in
          </Link>
        </CardFooter>
      </Card>
    </main>
  )
}
