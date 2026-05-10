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
import { useNavigationGuard } from "@/components/editor/useNavigationGuard"
import { UnsavedChangesDialog } from "@/components/editor/UnsavedChangesDialog"
import { parsePayloadError } from "@/lib/api"
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

  // Block accidental nav loss when either form has unsaved edits or a
  // save is in flight. Hook installs a native beforeunload prompt (tab
  // close / refresh / address-bar nav) plus a click + popstate guard for
  // in-app navigation. pending/confirm/cancel surface the custom dialog below.
  const guard = useNavigationGuard(
    nameForm.formState.isDirty ||
      passwordForm.formState.isDirty ||
      namePending ||
      passwordPending,
  )

  const onUpdateName = async (v: z.infer<typeof nameSchema>) => {
    setNamePending(true)
    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: v.name })
    })
    setNamePending(false)
    if (!res.ok) {
      // FN-2026-0055 — surface a parsed Payload error instead of a raw
      // response.text().slice. Same `parsePayloadError` helper used
      // everywhere else.
      const detail = await parsePayloadError(res)
      toast.error(`Update failed: ${detail.message}`)
      return
    }
    // FN-2026-0032 — advance RHF dirty baseline synchronously (sister of
    // FN-2026-0012). The password-form path already calls passwordForm.
    // reset(); the name-form path was missing the equivalent.
    nameForm.reset(v)
    toast.success("Profile updated")
    router.refresh()
  }

  const onUpdatePassword = async (v: z.infer<typeof passwordSchema>) => {
    setPasswordPending(true)
    // Audit-p1 #7 sub-fix A — single POST to the verified-self-change
    // endpoint. The server re-checks `currentPassword` and rotates the
    // user's session on success (sub-fix B), invalidating every other
    // pre-rotation JWT. The endpoint sets a fresh `payload-token` cookie
    // on the 200 response so this tab stays logged in across the rotation.
    //
    // Replaces the previous client-side login pre-check + naive PATCH —
    // a stolen cookie could bypass that pair (the audit's repro). The new
    // endpoint authoritatively binds "knew current password" to "is
    // allowed to set a new password" on the server.
    const res = await fetch("/api/users/change-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        currentPassword: v.currentPassword,
        newPassword: v.newPassword,
      }),
    })
    setPasswordPending(false)
    if (!res.ok) {
      // Map server status to a user-friendly message; preserve the prior
      // UX where 403 surfaces as "current password incorrect" (the only
      // 403 the endpoint emits comes from payload.login throwing).
      if (res.status === 403) {
        toast.error("Current password is incorrect")
        return
      }
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
            <form onSubmit={nameForm.handleSubmit(onUpdateName)} noValidate className="space-y-3">
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
            <form onSubmit={passwordForm.handleSubmit(onUpdatePassword)} noValidate className="space-y-3">
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
      <UnsavedChangesDialog
        open={guard.pending !== null}
        onCancel={guard.cancel}
        onConfirm={guard.confirm}
      />
    </div>
  )
}
