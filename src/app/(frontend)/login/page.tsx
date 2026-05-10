import { Suspense } from "react"
import Link from "next/link"
import { Globe } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LoginForm } from "@/components/forms/LoginForm"

/**
 * UX-2026-0023 / GitHub issue #9 — adopts the shadcn `login-03` block
 * pattern (queried via shadcn MCP `view_items_in_registries` +
 * `get_item_examples_from_registries`):
 *   - muted background on the outer wrapper
 *   - brand mark above the centered card (icon-square + brand name)
 *   - card with text-center header: greeting + supporting description
 *   - form unchanged below
 *
 * Brand mark uses a Globe lucide icon as a placeholder until the design
 * team produces a real SVG asset; the icon-square + bg-primary +
 * text-primary-foreground shape mirrors login-03's reference verbatim.
 *
 * Departures from login-03 verbatim:
 *   - No OAuth (Apple/Google) section — siab-payload is invite-only,
 *     no third-party identity providers in scope.
 *   - No "Don't have an account? Sign up" footer — invite-only.
 *   - Terms / Privacy footer omitted until Legal copy exists.
 */
export default function LoginPage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link href="/" className="flex items-center gap-2 self-center font-medium">
          <span
            aria-hidden
            className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground"
          >
            <Globe className="size-4" />
          </span>
          SiteInABox
        </Link>
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Welcome back</CardTitle>
            <CardDescription>Sign in to manage your sites</CardDescription>
          </CardHeader>
          <CardContent>
            {/* useSearchParams in LoginForm requires Suspense per Next 15 */}
            <Suspense>
              <LoginForm />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
