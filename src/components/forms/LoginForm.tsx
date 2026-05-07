"use client"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { toast } from "sonner"

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password required")
})

export function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [pending, setPending] = useState(false)
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
    const next = params.get("next") || "/"
    router.replace(next)
  }

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
