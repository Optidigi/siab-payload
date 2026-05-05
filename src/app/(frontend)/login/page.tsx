import { Suspense } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LoginForm } from "@/components/forms/LoginForm"

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader><CardTitle>Sign in</CardTitle></CardHeader>
        <CardContent>
          {/* useSearchParams in LoginForm requires Suspense per Next 15 */}
          <Suspense>
            <LoginForm />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  )
}
