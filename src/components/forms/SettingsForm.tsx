"use client"
import { useState } from "react"
import { useForm, FormProvider } from "react-hook-form"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FieldRenderer } from "@/components/editor/FieldRenderer"
import { toast } from "sonner"
import { Settings as SettingsIcon, Palette, Mail, Compass } from "lucide-react"

const generalFields = [
  { name: "siteName", type: "text", label: "Site name", required: true },
  { name: "siteUrl", type: "url", label: "Site URL", required: true,
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
            <CardHeader className="border-b p-0">
              <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0 md:overflow-visible flex justify-center [&::-webkit-scrollbar]:hidden">
                <TabsList className="mx-auto w-max">
                  {tabs.map(({ key, label, Icon }) => (
                    <TabsTrigger key={key} value={key} aria-label={label} className="shrink-0 gap-1.5">
                      <Icon className="h-4 w-4" aria-hidden />
                      <span className="max-md:hidden">{label}</span>
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
    </FormProvider>
  )
}
