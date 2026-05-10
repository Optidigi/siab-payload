"use client"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { validateNextRedirect } from "@/lib/auth/validateNextRedirect"

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password required")
})

// FN-2026-0043 — surface a friendly inline alert for the documented gate
// reasons in src/lib/gateDecision.ts. The middleware bounces a tenant
// user from the super-admin host (or a super-admin from a tenant host)
// to /login?error=<reason> with no UI signal pre-fix; users would re-
// enter credentials and get the same redirect, looking identical to a
// password failure.
const ERROR_COPY: Record<string, string> = {
  "wrong-host":
    "This account belongs to a different site. Sign in from your tenant's admin URL (e.g. admin.yoursite.com).",
  "super-admin-on-tenant-host":
    "Super-admin accounts must sign in from the workspace host, not a tenant subdomain.",
  "cross-tenant":
    "This account is not a member of this tenant. Sign in from your own tenant's admin URL.",
  "no-user":
    "We couldn't find an account matching that session. Please sign in again.",
  forbidden: "You don't have permission to access that page. Sign in with an account that does."
}

export function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [pending, setPending] = useState(false)
  const errorParam = params.get("error")
  const errorCopy = errorParam ? (ERROR_COPY[errorParam] ?? `Sign-in error: ${errorParam}`) : null
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" }
  })

  const onSubmit = async (values: z.infer<typeof schema>) => {
    setPending(true)
    const res = await fetch("/api/users/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(values)
    })
    setPending(false)
    if (!res.ok) {
      toast.error("Invalid email or password")
      return
    }
    const next = validateNextRedirect(params.get("next"))
    router.replace(next)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
        {errorCopy && (
          <Alert variant="destructive" role="alert">
            <AlertTriangle className="h-4 w-4" aria-hidden />
            <AlertDescription>{errorCopy}</AlertDescription>
          </Alert>
        )}
        <FormField name="email" control={form.control} render={({ field }) => (
          <FormItem>
            <FormLabel>Email</FormLabel>
            <FormControl>
              <Input
                type="email"
                autoComplete="email"
                inputMode="email"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="next"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}/>
        <FormField name="password" control={form.control} render={({ field }) => (
          <FormItem>
            <FormLabel>Password</FormLabel>
            <FormControl>
              <Input
                type="password"
                autoComplete="current-password"
                enterKeyHint="go"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}/>
        <Button type="submit" disabled={pending} className="w-full">{pending ? "Signing in..." : "Sign in"}</Button>
        <div className="text-center text-sm">
          <a className="text-muted-foreground underline" href="/forgot-password">Forgot password?</a>
        </div>
      </form>
    </Form>
  )
}
