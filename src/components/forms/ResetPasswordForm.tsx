"use client"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { toast } from "sonner"

const schema = z.object({
  password: z.string().min(8, "Min 8 characters"),
  confirm: z.string()
}).refine((d) => d.password === d.confirm, { path: ["confirm"], message: "Passwords don't match" })

export function ResetPasswordForm({ token }: { token: string }) {
  const [pending, setPending] = useState(false)
  const router = useRouter()
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema), defaultValues: { password: "", confirm: "" }
  })

  const onSubmit = async (values: z.infer<typeof schema>) => {
    setPending(true)
    const res = await fetch("/api/users/reset-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: values.password, token })
    })
    setPending(false)
    if (!res.ok) { toast.error("Reset link expired or invalid"); return }
    toast.success("Password set. Signing you in.")
    router.replace("/")
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
        <FormField name="password" control={form.control} render={({ field }) => (
          <FormItem><FormLabel>New password</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>
        )}/>
        <FormField name="confirm" control={form.control} render={({ field }) => (
          <FormItem><FormLabel>Confirm</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>
        )}/>
        <Button type="submit" disabled={pending} className="w-full">{pending ? "Setting..." : "Set password"}</Button>
      </form>
    </Form>
  )
}
