"use client"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { TypedConfirmDialog } from "@/components/shared/TypedConfirmDialog"
import { toast } from "sonner"
import type { Tenant } from "@/payload-types"

// Mirrors the create-side schema in TenantForm.tsx, plus optional notes +
// the status enum. Slug regex matches the Tenants collection's expectation
// (lowercase ASCII + digits + hyphens) — keep in sync with src/collections/Tenants.ts
// if that ever validates more strictly.
const schema = z.object({
  name: z.string().min(2),
  slug: z.string().regex(/^[a-z0-9-]+$/, "Lowercase, digits, hyphens only"),
  domain: z.string().min(3),
  status: z.enum(["provisioning", "active", "suspended", "archived"]),
  siteRepo: z.string().optional(),
  notes: z.string().optional()
})
type Values = z.infer<typeof schema>

type Counts = { pages: number; media: number; forms: number; siteSettings: number }

export function TenantEditForm({ tenant, counts }: { tenant: Tenant; counts: Counts }) {
  const router = useRouter()
  const [savePending, setSavePending] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: tenant.name,
      slug: tenant.slug,
      domain: tenant.domain,
      status: tenant.status,
      siteRepo: tenant.siteRepo ?? "",
      notes: tenant.notes ?? ""
    }
  })

  const onSubmit = async (values: Values) => {
    setSavePending(true)
    const res = await fetch(`/api/tenants/${tenant.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(values)
    })
    setSavePending(false)
    if (!res.ok) {
      const txt = await res.text().catch(() => "")
      toast.error(`Save failed: ${txt.slice(0, 200)}`)
      return
    }
    toast.success("Tenant updated")
    if (values.slug !== tenant.slug) {
      // Slug change moves the tenant to a new URL — replace so back button doesn't 404.
      router.replace(`/sites/${values.slug}/edit`)
    } else {
      router.refresh()
    }
  }

  const onDelete = async () => {
    const res = await fetch(`/api/tenants/${tenant.id}`, { method: "DELETE" })
    if (!res.ok) {
      const txt = await res.text().catch(() => "")
      throw new Error(`Delete failed (${res.status}): ${txt.slice(0, 200)}`)
    }
    toast.success(`Deleted ${tenant.name}`)
    router.replace("/sites")
  }

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField name="name" control={form.control} render={({ field }) => (
            <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField name="slug" control={form.control} render={({ field }) => (
            <FormItem>
              <FormLabel>Slug</FormLabel>
              <FormControl><Input {...field} /></FormControl>
              <p className="text-xs text-muted-foreground">Used in admin URLs (<code className="text-[11px]">/sites/&lt;slug&gt;</code>). Changing this rewrites the URL.</p>
              <FormMessage />
            </FormItem>
          )} />
          <FormField name="domain" control={form.control} render={({ field }) => (
            <FormItem>
              <FormLabel>Domain</FormLabel>
              <FormControl><Input placeholder="clientasite.nl" {...field} /></FormControl>
              <p className="text-xs text-muted-foreground">Bare apex without <code className="text-[11px]">admin.</code> prefix; the middleware adds it.</p>
              <FormMessage />
            </FormItem>
          )} />
          <FormField name="status" control={form.control} render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="provisioning">Provisioning</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Flipping to <strong>archived</strong> moves the on-disk dir to <code className="text-[11px]">archived/</code>; flipping back restores it.</p>
              <FormMessage />
            </FormItem>
          )} />
          <FormField name="siteRepo" control={form.control} render={({ field }) => (
            <FormItem><FormLabel>Site repo</FormLabel><FormControl><Input placeholder="optidigi/site-clientasite" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField name="notes" control={form.control} render={({ field }) => (
            <FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <Button type="submit" disabled={savePending}>{savePending ? "Saving..." : "Save changes"}</Button>
        </form>
      </Form>

      <section className="rounded-md border border-destructive/40 bg-destructive/5 p-4">
        <h2 className="text-sm font-semibold text-destructive">Danger zone</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Deleting <strong>{tenant.name}</strong> permanently removes the tenant and{" "}
          <span className="font-medium">all associated content</span> (cascades at the
          database level). This cannot be undone.
        </p>
        <ul className="mt-3 list-disc pl-5 text-sm text-muted-foreground">
          <li>{counts.pages} page{counts.pages === 1 ? "" : "s"}</li>
          <li>{counts.media} media file{counts.media === 1 ? "" : "s"}</li>
          <li>{counts.forms} form submission{counts.forms === 1 ? "" : "s"}</li>
          <li>{counts.siteSettings === 0 ? "No site settings" : "Site settings (1 record)"}</li>
          <li>On-disk dir at <code className="text-[11px]">tenants/{tenant.id}/</code> (and any <code className="text-[11px]">archived/{tenant.id}/</code>)</li>
          <li>Tenant-membership rows for any users assigned to this tenant (the user records themselves stay)</li>
        </ul>
        <Button
          type="button"
          variant="destructive"
          className="mt-4"
          onClick={() => setDeleteOpen(true)}
        >
          Delete tenant
        </Button>
      </section>

      <TypedConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${tenant.name}`}
        description={
          <>
            About to delete tenant <strong>{tenant.name}</strong> ({tenant.domain}). This
            cascade-deletes <strong>{counts.pages}</strong> pages,{" "}
            <strong>{counts.media}</strong> media files,{" "}
            <strong>{counts.forms}</strong> form submissions, and removes the tenant's
            on-disk dir. Irreversible.
          </>
        }
        confirmPhrase={tenant.slug}
        confirmLabel="Delete tenant"
        onConfirm={onDelete}
      />
    </div>
  )
}
