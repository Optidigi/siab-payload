"use client"
import { useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { toast } from "sonner"
import { slugify } from "@/lib/slugify"

const schema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  slug: z.string().regex(/^[a-z0-9-]+$/, "Lowercase, digits, hyphens only"),
  domain: z.string().min(3, "Enter a domain (at least 3 characters, e.g. clientasite.nl)"),
  siteRepo: z.string().optional()
})
type Values = z.infer<typeof schema>

export function TenantForm() {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", slug: "", domain: "", siteRepo: "" }
  })

  // FN-2026-0042 — auto-derive slug from Name on Name onBlur, but ONLY
  // while the slug has not been manually touched. The ref tracks
  // explicit user edits to the slug input; once the user types in slug,
  // we never overwrite it from name again.
  const slugTouched = useRef(false)
  const onNameBlur = () => {
    if (slugTouched.current) return
    const name = form.getValues("name")
    const currentSlug = form.getValues("slug")
    if (currentSlug && currentSlug !== "") return
    const derived = slugify(name ?? "")
    if (derived) form.setValue("slug", derived, { shouldDirty: true, shouldValidate: true })
  }

  const onSubmit = async (values: Values) => {
    setPending(true)
    const res = await fetch("/api/tenants", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...values, status: "provisioning" })
    })
    setPending(false)
    if (!res.ok) {
      toast.error("Failed to create tenant")
      return
    }
    toast.success("Tenant created")
    router.replace(`/sites/${values.slug}/onboarding`)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4 max-w-md">
        <FormField name="name" control={form.control} render={({ field }) => (
          <FormItem>
            <FormLabel>Name</FormLabel>
            <FormControl>
              <Input
                {...field}
                onBlur={(e) => {
                  field.onBlur()
                  onNameBlur()
                  // hand off the bubble — RHF's field.onBlur handles the
                  // form-level mark-touched
                  e.preventDefault?.()
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField name="slug" control={form.control} render={({ field }) => (
          <FormItem>
            <FormLabel>Slug</FormLabel>
            <FormControl>
              <Input
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                {...field}
                onChange={(e) => {
                  // FN-2026-0042 — once the user types in slug, lock the
                  // auto-derive off so we never overwrite their work.
                  slugTouched.current = true
                  field.onChange(e)
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField name="domain" control={form.control} render={({ field }) => (
          <FormItem>
            <FormLabel>Domain</FormLabel>
            <FormControl>
              <Input
                type="url"
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
                placeholder="clientasite.nl"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField name="siteRepo" control={form.control} render={({ field }) => (
          <FormItem><FormLabel>Site repo (optional)</FormLabel><FormControl><Input placeholder="optidigi/site-clientasite" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <Button type="submit" disabled={pending}>{pending ? "Creating..." : "Create tenant"}</Button>
      </form>
    </Form>
  )
}
