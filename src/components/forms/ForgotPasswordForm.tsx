"use client"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { toast } from "sonner"

const schema = z.object({ email: z.string().email() })

export function ForgotPasswordForm() {
  const [pending, setPending] = useState(false)
  const [sent, setSent] = useState(false)
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema), defaultValues: { email: "" }
  })

  const onSubmit = async (values: z.infer<typeof schema>) => {
    setPending(true)
    await fetch("/api/users/forgot-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(values)
    })
    setPending(false)
    setSent(true)
    toast.success("If that email exists, a reset link has been sent.")
  }

  if (sent) return <div className="text-sm text-muted-foreground">Check your inbox for a reset link.</div>

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField name="email" control={form.control} render={({ field }) => (
          <FormItem>
            <FormLabel>Email</FormLabel>
            <FormControl><Input type="email" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )}/>
        <Button type="submit" disabled={pending} className="w-full">{pending ? "Sending..." : "Send reset link"}</Button>
      </form>
    </Form>
  )
}
