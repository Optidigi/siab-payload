"use client"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { TypedConfirmDialog } from "@/components/typed-confirm-dialog"
import { useNavigationGuard } from "@/components/editor/useNavigationGuard"
import { UnsavedChangesDialog } from "@/components/editor/UnsavedChangesDialog"
import { parsePayloadError } from "@/lib/api"
import { toast } from "sonner"
import type { User } from "@/payload-types"

// Mirrors Users.ts validateTenants: super-admin must have empty tenants[],
// non-super-admin must have exactly one. The server validator is the source
// of truth; this client schema is just there to keep the form coherent and
// produce reasonable error messages before hitting the wire.
const schema = z
  .object({
    name: z.string().min(1, "Name is required"),
    role: z.enum(["super-admin", "owner", "editor", "viewer"]),
    tenantId: z.string().optional()
  })
  .refine(
    (d) => d.role === "super-admin" || (d.tenantId && d.tenantId !== ""),
    { path: ["tenantId"], message: "Tenant is required for non-super-admin roles" }
  )
type Values = z.infer<typeof schema>

type TenantLite = { id: number | string; name: string; slug: string }

export function UserEditForm({ user, tenants }: { user: User; tenants: TenantLite[] }) {
  const router = useRouter()
  const [savePending, setSavePending] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  // Extract current tenant id from the user's tenants[] array (Wave 1 shape).
  const currentTenantId = user.tenants?.[0]?.tenant
  const currentTenantIdString =
    currentTenantId == null
      ? ""
      : typeof currentTenantId === "object"
        ? String(currentTenantId.id)
        : String(currentTenantId)

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: user.name ?? "",
      role: user.role,
      tenantId: currentTenantIdString
    }
  })

  const role = form.watch("role")

  // Block accidental nav loss when the form has unsaved edits or a save
  // is in flight. Hook installs a native beforeunload prompt (tab close /
  // refresh / address-bar nav) plus a click + popstate guard for in-app
  // navigation. pending/confirm/cancel surface the custom dialog below.
  const guard = useNavigationGuard(form.formState.isDirty || savePending)

  const onSubmit = async (values: Values) => {
    setSavePending(true)
    // Map the form's flat tenantId back to the validator's array shape.
    // Server still enforces the invariant; this is just the wire format.
    const body: Record<string, unknown> = {
      name: values.name,
      role: values.role,
      tenants:
        values.role === "super-admin"
          ? []
          : [{ tenant: isNaN(Number(values.tenantId)) ? values.tenantId : Number(values.tenantId) }]
    }
    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    })
    setSavePending(false)
    if (!res.ok) {
      const detail = await parsePayloadError(res)
      // Surface specific path errors inline; otherwise toast.
      if (detail.field === "name" || detail.field === "role" || detail.field === "tenants") {
        const formField = detail.field === "tenants" ? "tenantId" : detail.field
        form.setError(formField as "name" | "role" | "tenantId", { message: detail.message })
        toast.error(`${detail.field}: ${detail.message}`)
      } else {
        toast.error(`Save failed: ${detail.message}`)
      }
      return
    }
    // FN-2026-0031 — sister of FN-2026-0012: advance RHF's dirty
    // baseline synchronously so useNavigationGuard detaches its
    // beforeunload listener before the next nav can race.
    form.reset(values)
    toast.success("User updated")
    router.refresh()
  }

  const onDelete = async () => {
    const res = await fetch(`/api/users/${user.id}`, { method: "DELETE" })
    if (!res.ok) {
      const detail = await parsePayloadError(res)
      throw new Error(`Delete failed (${res.status}): ${detail.message}`)
    }
    toast.success(`Removed ${user.email}`)
    router.replace("/users")
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
          <FormItem>
            <FormLabel>Email</FormLabel>
            <FormControl>
              <Input value={user.email} disabled readOnly />
            </FormControl>
            <p className="text-xs text-muted-foreground">
              Email is the canonical identifier and cannot be changed via this form. To change a
              user&apos;s email, delete this account and create a new one.
            </p>
          </FormItem>

          <FormField name="name" control={form.control} render={({ field }) => (
            <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
          )} />

          <FormField name="role" control={form.control} render={({ field }) => (
            <FormItem>
              <FormLabel>Role</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="super-admin">Super-admin</SelectItem>
                  <SelectItem value="owner">Owner</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Super-admins manage all tenants and have <strong>no</strong> tenant assignment.
                Other roles must be assigned to exactly one tenant.
              </p>
              <FormMessage />
            </FormItem>
          )} />

          {role !== "super-admin" && (
            <FormField name="tenantId" control={form.control} render={({ field }) => (
              <FormItem>
                <FormLabel>Tenant</FormLabel>
                <Select value={field.value || ""} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select tenant" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {tenants.map((t) => (
                      <SelectItem key={String(t.id)} value={String(t.id)}>
                        {t.name} <span className="text-muted-foreground">({t.slug})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
          )}

          <Button type="submit" disabled={savePending}>{savePending ? "Saving..." : "Save changes"}</Button>
        </form>
      </Form>

      {/* WCAG 1.4.3 — text colours dropped to `foreground` so they meet 4.5:1
          against bg-destructive/5 over the card. Destructive cue preserved by
          the section's red border + bg tint + the destructive Delete button. */}
      <section className="rounded-md border border-destructive/40 bg-destructive/5 p-4">
        <h2 className="text-sm font-semibold text-foreground">Danger zone</h2>
        <p className="mt-2 text-sm text-foreground">
          Removing <strong>{user.email}</strong> permanently deletes the account and revokes
          access. The user&apos;s tenant-membership rows are removed; tenants and their content stay.
          {user.role !== "super-admin" && (
            <> The user can be re-invited later, but with a fresh history.</>
          )}
        </p>
        <Button
          type="button"
          variant="destructive"
          className="mt-4"
          onClick={() => setDeleteOpen(true)}
        >
          Delete user
        </Button>
      </section>

      <TypedConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Remove user"
        description={
          <>
            About to delete <strong>{user.email}</strong>. This is irreversible — type the email
            below to confirm.
          </>
        }
        confirmPhrase={user.email}
        confirmLabel="Remove user"
        onConfirm={onDelete}
      />
      <UnsavedChangesDialog
        open={guard.pending !== null}
        onCancel={guard.cancel}
        onConfirm={guard.confirm}
      />
    </div>
  )
}
