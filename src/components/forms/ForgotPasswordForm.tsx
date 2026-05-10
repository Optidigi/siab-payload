"use client"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { toast } from "sonner"

const schema = z.object({ email: z.string().email("Enter a valid email address") })

export function ForgotPasswordForm() {
  const [pending, setPending] = useState(false)
  const [sent, setSent] = useState(false)
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema), defaultValues: { email: "" }
  })

  const onSubmit = async (values: z.infer<typeof schema>) => {
    setPending(true)
    // FN-2026-0037 — pre-fix shape called .ok-blind: await fetch then
    // setSent(true) + success toast UNCONDITIONALLY. A 400/500/429/network
    // error left the user thinking the email was queued. Branch on
    // res.ok and surface a real error toast otherwise. We intentionally
    // keep the SUCCESS copy generic ("If that email exists...") to
    // preserve user-enumeration resistance — but only when the server
    // actually accepted the request.
    let res: Response | null = null
    try {
      res = await fetch("/api/users/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values)
      })
    } catch {
      // Network error — distinct from 4xx/5xx
      setPending(false)
      toast.error("Network error — please try again")
      return
    }
    setPending(false)
    if (!res.ok) {
      // 429 (rate limit) gets a distinct message; everything else generic.
      if (res.status === 429) {
        toast.error("Too many requests — please wait a minute and try again")
      } else {
        toast.error(`Could not send reset link (HTTP ${res.status})`)
      }
      return
    }
    setSent(true)
    toast.success("If that email exists, a reset link has been sent.")
  }

  if (sent) return <div className="text-sm text-muted-foreground">Check your inbox for a reset link.</div>

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
        <FormField name="email" control={form.control} render={({ field }) => (
          <FormItem>
            <FormLabel>Email</FormLabel>
            <FormControl>
              <Input
                type="email"
                autoComplete="email"
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="go"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}/>
        <Button type="submit" disabled={pending} className="w-full">{pending ? "Sending..." : "Send reset link"}</Button>
      </form>
    </Form>
  )
}
