"use client"
import { useState } from "react"
import { useForm, FormProvider } from "react-hook-form"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FieldRenderer } from "@/components/editor/FieldRenderer"
import { toast } from "sonner"

const generalFields = [
  { name: "siteName", type: "text", label: "Site name", required: true },
  { name: "siteUrl", type: "text", label: "Site URL", required: true,
    admin: { description: "Public URL of the SSR site (e.g. https://clientasite.nl)" } },
  { name: "contactEmail", type: "email", label: "Contact email" }
]

const brandingFields = [
  { type: "group", name: "branding", label: "Branding", fields: [
    { name: "logo", type: "upload", relationTo: "media", label: "Logo" },
    { name: "primaryColor", type: "text", label: "Primary color (hex)" }
  ]}
]

const contactFields = [
  { type: "group", name: "contact", label: "Contact", fields: [
    { name: "phone", type: "text", label: "Phone" },
    { name: "address", type: "textarea", label: "Address" },
    { type: "array", name: "social", label: "Social links", singularLabel: "link", fields: [
      { name: "platform", type: "text", label: "Platform", required: true },
      { name: "url", type: "text", label: "URL", required: true }
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

export function SettingsForm({ initial, canEdit }: { initial: any; canEdit: boolean }) {
  const router = useRouter()
  const form = useForm({ defaultValues: initial })
  const [pending, setPending] = useState(false)

  const onSubmit = form.handleSubmit(async (values) => {
    setPending(true)
    const tenantId = initial.tenant?.id ?? initial.tenant
    const res = await fetch(`/api/site-settings/${initial.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...values, tenant: tenantId })
    })
    setPending(false)
    if (!res.ok) { toast.error("Save failed"); return }
    toast.success("Saved")
    router.refresh()
  })

  const tabs: Array<[string, any[]]> = [
    ["general", generalFields],
    ["branding", brandingFields],
    ["contact", contactFields],
    ["navigation", navigationFields]
  ]

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} className="space-y-4 max-w-3xl">
        <Tabs defaultValue="general">
          <TabsList>
            {tabs.map(([k]) => (
              <TabsTrigger key={k} value={k} className="capitalize">{k}</TabsTrigger>
            ))}
          </TabsList>
          {tabs.map(([k, fs]) => (
            <TabsContent key={k} value={k}>
              <Card>
                <CardHeader><CardTitle className="capitalize">{k}</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {fs.map((f: any, i: number) => <FieldRenderer key={i} field={f} />)}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
        {canEdit && (
          <Button type="submit" disabled={pending}>{pending ? "Saving..." : "Save settings"}</Button>
        )}
      </form>
    </FormProvider>
  )
}
