"use client"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { toast } from "sonner"

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
          <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField name="slug" control={form.control} render={({ field }) => (
          <FormItem>
            <FormLabel>Slug</FormLabel>
            <FormControl>
              <Input
                inputMode="url"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                {...field}
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
                autoCapitalize="off"
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
