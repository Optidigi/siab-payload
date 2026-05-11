import { Suspense } from "react"
import { LoginForm } from "@/components/forms/LoginForm"
import { Login04 } from "@/components/login-04"

/**
 * Adopts the shadcn `login-04` block via @siab/login-04 — two-column card
 * with the form on the left and a branded media panel on the right.
 * The Login04 shell stacks to a single column on phone widths.
 *
 * Departures from a generic login-04:
 *   - No OAuth (Apple/Google) section — siab-payload is invite-only.
 *   - No "Don't have an account? Sign up" footer — invite-only.
 *   - Right panel uses the real SVG logo with dark/light CSS switching.
 */
export default function LoginPage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-muted p-6 md:p-10 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
      <div className="w-full max-w-sm md:max-w-4xl">
        <Login04
          media={
            <div className="absolute inset-0 flex items-center justify-center bg-primary p-8">
              <img src="/logos/logo-dark.svg"  alt="SiteInABox" className="h-32 w-auto max-w-full dark:hidden" />
              <img src="/logos/logo-light.svg" alt="SiteInABox" className="hidden dark:block h-32 w-auto max-w-full" />
            </div>
          }
        >
          <div className="flex flex-col gap-6">
            <div className="flex flex-col items-center gap-2 text-center">
              <h1 className="text-2xl font-bold">Welcome back</h1>
              <p className="text-balance text-muted-foreground">
                Sign in to manage your sites
              </p>
            </div>
            <Suspense>
              <LoginForm />
            </Suspense>
          </div>
        </Login04>
      </div>
    </main>
  )
}
