"use client"
import { useState } from "react"
import { useForm, FormProvider } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FieldRenderer } from "@/components/editor/FieldRenderer"
import { useNavigationGuard } from "@/components/editor/useNavigationGuard"
import { UnsavedChangesDialog } from "@/components/editor/UnsavedChangesDialog"
import { parsePayloadError } from "@/lib/api"
import { toast } from "sonner"
import { Settings as SettingsIcon, Palette, Mail, Compass } from "lucide-react"

const generalFields = [
  { name: "siteName", type: "text", label: "Site name", required: true },
  { name: "siteUrl", type: "url", label: "Site URL", required: true,
    admin: { description: "Public URL of the SSR site (e.g. https://clientasite.nl)" } },
  { name: "contactEmail", type: "email", label: "Contact email" }
]

// FN-2026-0063 (operator request) — Logo upload removed from the
// Settings UI: the whitelabel feature is out of scope for current
// clients, and pre-fix the upload field didn't actually persist (sister
// of FN-2026-0062 MediaPicker eager-normalize bug). The schema field
// remains in `src/collections/SiteSettings.ts` for backwards-compat with
// any persisted data; a future migration may drop the column when the
// audit-trail is satisfied.
const brandingFields = [
  { type: "group", name: "branding", label: "Branding", fields: [
    { name: "primaryColor", type: "text", label: "Primary color (hex)" }
  ]}
]

const contactFields = [
  { type: "group", name: "contact", label: "Contact", fields: [
    { name: "phone", type: "tel", label: "Phone" },
    { name: "address", type: "textarea", label: "Address" },
    { type: "array", name: "social", label: "Social links", singularLabel: "link", fields: [
      { name: "platform", type: "text", label: "Platform", required: true },
      { name: "url", type: "url", label: "URL", required: true }
    ]}
  ]}
]

const navigationFields = [
  { type: "array", name: "navigation", label: "Navigation", singularLabel: "menu item", fields: [
    { name: "label", type: "text", label: "Label", required: true },
    { name: "href", type: "text", label: "Href", required: true },
    { name: "external", type: "checkbox", label: "External" }
  ]}
]

// FN-2026-0034 — minimal zod schema covering the required + format-validated
// fields. Other fields (.passthrough so the form doesn't strip optional
// nested data on save). The collection's server-side validators remain the
// authority on shape; this gives the user immediate inline feedback for
// the obvious failures (empty siteName, malformed contactEmail, malformed
// hex color) without waiting for a server round-trip.
const settingsSchema = z.object({
  siteName: z.string().min(1, "Site name is required"),
  siteUrl: z.string().url("Enter a valid URL (e.g. https://clientasite.nl)"),
  contactEmail: z.union([
    z.string().email("Enter a valid email address"),
    z.literal(""),
    z.null()
  ]).optional(),
  branding: z.object({
    primaryColor: z.union([
      z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i, "Hex color (e.g. #2563eb or #25b)"),
      z.literal(""),
      z.null()
    ]).optional()
  }).passthrough().optional()
}).passthrough()

type Values = z.infer<typeof settingsSchema>

export function SettingsForm({ initial, canEdit }: { initial: any; canEdit: boolean }) {
  const router = useRouter()
  const form = useForm<Values>({
    resolver: zodResolver(settingsSchema),
    defaultValues: initial
  })
  const [pending, setPending] = useState(false)

  // FN-2026-0050 — guard against accidental nav loss with unsaved settings.
  // Same shape every other form in the admin uses.
  const guard = useNavigationGuard(form.formState.isDirty || pending)

  const onSubmit = form.handleSubmit(async (values) => {
    setPending(true)
    // FN-2026-0056 — never send `tenant` on PATCH. Pre-fix the form spread
    // `{ ...values, tenant: tenantId }` into the body, which (a) the server
    // rejects with 500 for any non-matching tenant id (cross-tenant write),
    // and (b) is meaningless for in-place updates: the row's tenant is
    // already the current tenant. Strip it.
    const { tenant: _ignore, id: _idIgnore, ...patchBody } = values as Values & {
      tenant?: unknown
      id?: unknown
    }
    let res: Response
    try {
      res = await fetch(`/api/site-settings/${initial.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patchBody)
      })
    } catch {
      setPending(false)
      toast.error("Network error — please try again")
      return
    }
    setPending(false)
    if (!res.ok) {
      // FN-2026-0034 — surface the field-tied error inline + a useful toast.
      const detail = await parsePayloadError(res)
      if (detail.field) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          form.setError(detail.field as any, { type: "server", message: detail.message })
        } catch {
          // RHF rejects unknown paths — just toast.
        }
        toast.error(`${detail.field}: ${detail.message}`)
      } else {
        toast.error(`Save failed: ${detail.message}`)
      }
      return
    }
    // FN-2026-0051 — clear dirty baseline post-save so navigationGuard
    // detaches; mirrors PageForm / TenantEditForm post-fix shape.
    form.reset(values)
    toast.success("Saved")
    router.refresh()
  })

  const tabs = [
    { key: "general",    label: "General",    Icon: SettingsIcon, fields: generalFields },
    { key: "branding",   label: "Branding",   Icon: Palette,      fields: brandingFields },
    { key: "contact",    label: "Contact",    Icon: Mail,         fields: contactFields },
    { key: "navigation", label: "Navigation", Icon: Compass,      fields: navigationFields },
  ]

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="max-w-3xl">
        <Card>
          <Tabs defaultValue="general">
            {/*
              Phone (under md): bleed the scroll-area to the viewport edges with
              -mx-4 + px-4 so it feels like a native horizontal scroller. w-max
              on TabsList lets it size to its content; shrink-0 on each Trigger
              prevents collapse. Desktop reverts to default layout. The
              ::-webkit-scrollbar:hidden hides the macOS/Chrome scroll bar
              without losing scroll behavior.
            */}
            {/* U1 + U8 / GitHub issue #11 — on mobile, the tablist now spans
                full width as a 4-col grid with the label visible alongside the
                icon (was icon-only at 34×29). Desktop keeps the centered
                w-max layout for density. */}
            <CardHeader className="border-b p-0">
              <div className="md:flex md:justify-center md:px-0 md:mx-0">
                <TabsList className="max-md:w-full max-md:grid max-md:grid-cols-4 md:mx-auto md:w-max">
                  {tabs.map(({ key, label, Icon }) => (
                    <TabsTrigger
                      key={key}
                      value={key}
                      aria-label={label}
                      className="gap-1.5 max-md:px-1 max-md:min-w-0"
                    >
                      <Icon className="h-4 w-4" aria-hidden />
                      <span className="text-xs max-md:inline md:text-sm max-md:truncate max-md:min-w-0">{label}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
            </CardHeader>
            <CardContent>
              {tabs.map(({ key, fields }) => (
                <TabsContent key={key} value={key} className="space-y-3">
                  {fields.map((f: any, i: number) => <FieldRenderer key={i} field={f} />)}
                </TabsContent>
              ))}
            </CardContent>
          </Tabs>
          {canEdit && (
            <CardFooter className="border-t justify-end">
              <Button type="submit" disabled={pending}>{pending ? "Saving..." : "Save settings"}</Button>
            </CardFooter>
          )}
        </Card>
      </form>
      <UnsavedChangesDialog
        open={guard.pending !== null}
        onCancel={guard.cancel}
        onConfirm={guard.confirm}
      />
    </FormProvider>
  )
}
