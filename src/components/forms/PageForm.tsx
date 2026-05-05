"use client"
import { useState } from "react"
import { useForm } from "react-hook-form"
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
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: initial
      ? { title: initial.title, slug: initial.slug ?? "", status: (initial.status as "draft" | "published") ?? "draft",
          blocks: (initial.blocks as any) ?? [], seo: (initial.seo as any) ?? {} }
      : { title: "", slug: "", status: "draft", blocks: [], seo: {} }
  })

  const onSubmit = async (values: Values) => {
    setPending(true)
    const url = initial ? `/api/pages/${initial.id}` : "/api/pages"
    const method = initial ? "PATCH" : "POST"
    const body = JSON.stringify({ ...values, tenant: tenantId })
    const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body })
    setPending(false)
    if (!res.ok) { toast.error("Save failed"); return }
    toast.success(values.status === "published" ? "Published" : "Saved")
    if (!initial) {
      const json = await res.json()
      const newId = json.doc?.id ?? json.id
      router.replace(`${baseHref}/${newId}`)
    } else {
      router.refresh()
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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
    </Form>
  )
}
