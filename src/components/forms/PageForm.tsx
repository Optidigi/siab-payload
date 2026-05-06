"use client"
import { useState } from "react"
import { useForm, type FieldErrors } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BlockEditor } from "@/components/editor/BlockEditor"
import { FieldRenderer } from "@/components/editor/FieldRenderer"
import { SaveStatusBar, type SaveStatus } from "@/components/editor/SaveStatusBar"
import { useNavigationGuard } from "@/components/editor/useNavigationGuard"
import { UnsavedChangesDialog } from "@/components/editor/UnsavedChangesDialog"
import { parsePayloadError } from "@/lib/api"
import { scrollToFirstError } from "@/lib/formScroll"
import { toast } from "sonner"
import type { Page } from "@/payload-types"

const schema = z.object({
  title: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9-]+$/, "Lowercase, digits, hyphens only"),
  status: z.enum(["draft", "published"]),
  blocks: z.array(z.any()),
  seo: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    ogImage: z.any().optional()
  }).optional()
})
type Values = z.infer<typeof schema>

const seoFields = [
  { name: "title", type: "text", label: "SEO title" },
  { name: "description", type: "textarea", label: "SEO description" },
  { name: "ogImage", type: "upload", relationTo: "media", label: "Open Graph image" }
]

export function PageForm({ initial, tenantId, baseHref }: { initial?: Page; tenantId: number | string; baseHref: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: initial
      ? { title: initial.title, slug: initial.slug ?? "", status: (initial.status as "draft" | "published") ?? "draft",
          blocks: (initial.blocks as any) ?? [], seo: (initial.seo as any) ?? {} }
      : { title: "", slug: "", status: "draft", blocks: [], seo: {} }
  })

  // Guard against accidental tab close / refresh / off-site nav while the
  // form has unsaved work or a save is in flight. Headless hook —
  // pairs with <UnsavedChangesDialog/> below for the in-app + popstate
  // confirms.
  const guard = useNavigationGuard(form.formState.isDirty || pending)

  const onSubmit = async (values: Values) => {
    setPending(true)
    setSubmitError(null)
    const url = initial ? `/api/pages/${initial.id}` : "/api/pages"
    const method = initial ? "PATCH" : "POST"
    const body = JSON.stringify({ ...values, tenant: tenantId })
    let res: Response
    try {
      res = await fetch(url, { method, headers: { "content-type": "application/json" }, body })
    } catch (e) {
      setPending(false)
      const msg = e instanceof Error ? e.message : "Network error"
      setSubmitError(msg)
      toast.error("Save failed")
      return
    }
    setPending(false)
    if (!res.ok) {
      // Drill into Payload's error envelope so a slug-regex / unique
      // conflict / required-field error lights up the offending field
      // instead of bubbling up as an opaque "HTTP 400".
      const detail = await parsePayloadError(res)
      if (detail.field) {
        // RHF accepts dotted paths (e.g. "seo.title"). Cast widens to any
        // because `keyof Values` is only the top-level keys, but RHF's
        // runtime accepts the full FieldPath. Matches the pattern in
        // TenantEditForm/UserEditForm for consistency.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        form.setError(detail.field as any, {
          type: "server",
          message: detail.message
        })
        // setError mutates the errors object synchronously, but defer
        // the scroll to next frame so RHF has flushed re-renders that
        // would otherwise move the field's DOM position out from under
        // us.
        requestAnimationFrame(() => scrollToFirstError(form.formState.errors))
      }
      setSubmitError(detail.message)
      toast.error(`Save failed: ${detail.message}`)
      return
    }
    setSubmitError(null)
    setLastSavedAt(Date.now())
    // Reset RHF dirty state to the just-saved values so SaveStatusBar
    // transitions out of "dirty" once the save lands.
    form.reset(values, { keepValues: true })
    toast.success(values.status === "published" ? "Published" : "Saved")
    if (!initial) {
      const json = await res.json()
      const newId = json.doc?.id ?? json.id
      router.replace(`${baseHref}/${newId}`)
    } else {
      router.refresh()
    }
  }

  // RHF calls onInvalid when zod validation fails before onSubmit ever
  // runs. Jump the user to the first offending field.
  const onInvalid = (errors: FieldErrors<Values>) => {
    scrollToFirstError(errors as Record<string, unknown>)
  }

  const retry = () => form.handleSubmit(onSubmit, onInvalid)()
  const triggerSave = () => form.handleSubmit(onSubmit, onInvalid)()
  const jumpToError = () =>
    scrollToFirstError(form.formState.errors as Record<string, unknown>)

  // Compute save status for the pill. "idle" means: not dirty AND
  // nothing saved yet — keeps the pill hidden on initial render.
  // Validation errors take precedence over dirty so the operator sees
  // why their save was blocked.
  const isDirty = form.formState.isDirty
  const errorCount = Object.keys(form.formState.errors).length
  const dirtyCount = Object.keys(form.formState.dirtyFields).length
  let saveStatus: SaveStatus = "idle"
  if (pending) saveStatus = "saving"
  else if (errorCount > 0) saveStatus = "error"
  else if (submitError) saveStatus = "error"
  else if (isDirty) saveStatus = "dirty"
  else if (lastSavedAt) saveStatus = "saved"

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader><CardTitle>Page</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <FormField control={form.control} name="title" render={({ field }) => (
                  <FormItem><FormLabel>Title*</FormLabel><FormControl><Input {...field}/></FormControl><FormMessage/></FormItem>
                )}/>
                <FormField control={form.control} name="slug" render={({ field }) => (
                  <FormItem><FormLabel>Slug*</FormLabel><FormControl><Input {...field}/></FormControl><FormMessage/></FormItem>
                )}/>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Blocks</CardTitle></CardHeader>
              <CardContent><BlockEditor/></CardContent>
            </Card>
          </div>
          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Publish</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="published">Published</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage/>
                  </FormItem>
                )}/>
                <Button type="submit" disabled={pending} className="w-full">{pending ? "Saving..." : "Save"}</Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>SEO</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {seoFields.map((f, i) => <FieldRenderer key={i} field={f} namePrefix="seo"/>)}
              </CardContent>
            </Card>
          </div>
      </form>
      <SaveStatusBar
        status={saveStatus}
        dirtyCount={dirtyCount}
        errorCount={errorCount}
        onSave={triggerSave}
        onRetry={retry}
        onJumpToError={jumpToError}
      />
      <UnsavedChangesDialog
        open={guard.pending !== null}
        onCancel={guard.cancel}
        onConfirm={guard.confirm}
      />
    </Form>
  )
}
