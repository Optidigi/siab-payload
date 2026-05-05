"use client"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { RoleBadge } from "@/components/shared/RoleBadge"
import { toast } from "sonner"
import type { User } from "@/payload-types"

const nameSchema = z.object({
  name: z.string().min(1, "Name required"),
})
const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Current password required"),
  newPassword: z.string().min(8, "Min 8 characters"),
  confirm: z.string()
}).refine((d) => d.newPassword === d.confirm, { path: ["confirm"], message: "Passwords don't match" })

export function ProfileForm({ user }: { user: User }) {
  const router = useRouter()
  const [namePending, setNamePending] = useState(false)
  const [passwordPending, setPasswordPending] = useState(false)

  const nameForm = useForm<z.infer<typeof nameSchema>>({
    resolver: zodResolver(nameSchema),
    defaultValues: { name: user.name ?? "" }
  })

  const passwordForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirm: "" }
  })

  const onUpdateName = async (v: z.infer<typeof nameSchema>) => {
    setNamePending(true)
    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: v.name })
    })
    setNamePending(false)
    if (!res.ok) {
      const txt = await res.text()
      toast.error("Update failed: " + txt.slice(0, 100))
      return
    }
    toast.success("Profile updated")
    router.refresh()
  }

  const onUpdatePassword = async (v: z.infer<typeof passwordSchema>) => {
    setPasswordPending(true)
    // Payload's PATCH allows changing password directly when authenticated.
    // We additionally verify current password client-side via a quick login
    // attempt to prevent session hijack -> password change.
    const verify = await fetch("/api/users/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: user.email, password: v.currentPassword })
    })
    if (!verify.ok) {
      setPasswordPending(false)
      toast.error("Current password is incorrect")
      return
    }
    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: v.newPassword })
    })
    setPasswordPending(false)
    if (!res.ok) {
      const txt = await res.text()
      toast.error("Password update failed: " + txt.slice(0, 100))
      return
    }
    toast.success("Password changed")
    passwordForm.reset()
  }

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <Card>
        <CardHeader><CardTitle>Account</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-1">
            <span className="text-sm text-muted-foreground">Email</span>
            <span className="font-medium">{user.email}</span>
          </div>
          <div className="grid gap-1">
            <span className="text-sm text-muted-foreground">Role</span>
            <div><RoleBadge role={user.role}/></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Name</CardTitle></CardHeader>
        <CardContent>
          <Form {...nameForm}>
            <form onSubmit={nameForm.handleSubmit(onUpdateName)} className="space-y-3">
              <FormField name="name" control={nameForm.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>Display name</FormLabel>
                  <FormControl><Input {...field}/></FormControl>
                  <FormMessage/>
                </FormItem>
              )}/>
              <Button type="submit" disabled={namePending}>
                {namePending ? "Saving..." : "Save name"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Change password</CardTitle></CardHeader>
        <CardContent>
          <Form {...passwordForm}>
            <form onSubmit={passwordForm.handleSubmit(onUpdatePassword)} className="space-y-3">
              <FormField name="currentPassword" control={passwordForm.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>Current password</FormLabel>
                  <FormControl><Input type="password" autoComplete="current-password" {...field}/></FormControl>
                  <FormMessage/>
                </FormItem>
              )}/>
              <FormField name="newPassword" control={passwordForm.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>New password</FormLabel>
                  <FormControl><Input type="password" autoComplete="new-password" {...field}/></FormControl>
                  <FormMessage/>
                </FormItem>
              )}/>
              <FormField name="confirm" control={passwordForm.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm</FormLabel>
                  <FormControl><Input type="password" autoComplete="new-password" {...field}/></FormControl>
                  <FormMessage/>
                </FormItem>
              )}/>
              <Button type="submit" disabled={passwordPending}>
                {passwordPending ? "Updating..." : "Change password"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
