"use client"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { Plus, Copy } from "lucide-react"

const baseSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8, "Min 8 characters"),
  role: z.enum(["super-admin", "owner", "editor", "viewer"]),
  tenantId: z.string().optional(),
  enableAPIKey: z.boolean().default(false)
})
const schema = baseSchema.refine(
  (d) => d.role === "super-admin" || (d.tenantId && d.tenantId !== ""),
  { path: ["tenantId"], message: "tenant is required for non-super-admin roles" }
)

type Tenant = { id: number | string; name: string; slug: string }

export function CreateUserForm() {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [createdKey, setCreatedKey] = useState<{ apiKey: string; email: string } | null>(null)
  const [tenants, setTenants] = useState<Tenant[]>([])
  const router = useRouter()

  type FormValues = z.infer<typeof baseSchema>
  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as unknown as import("react-hook-form").Resolver<FormValues>,
    defaultValues: { email: "", name: "", password: "", role: "editor", tenantId: "", enableAPIKey: false }
  })

  const role = form.watch("role")
  const enableAPIKey = form.watch("enableAPIKey")

  // Load tenants when dialog opens
  useEffect(() => {
    if (!open) return
    fetch("/api/tenants?limit=200&sort=name").then((r) => r.json()).then((j) => {
      setTenants((j.docs ?? []).map((t: any) => ({ id: t.id, name: t.name, slug: t.slug })))
    }).catch(() => {})
  }, [open])

  const onSubmit = async (v: FormValues) => {
    setPending(true)
    // Step 1: create the user. Payload silently ignores `apiKey` on create
    // (verified during prod orchestrator-user setup), so we set it via PATCH
    // immediately afterward when needed.
    const createBody: any = {
      email: v.email, name: v.name, password: v.password, role: v.role
    }
    if (v.role !== "super-admin" && v.tenantId) {
      const tenantId = isNaN(Number(v.tenantId)) ? v.tenantId : Number(v.tenantId)
      createBody.tenants = [{ tenant: tenantId }]
    }
    if (v.enableAPIKey) {
      createBody.enableAPIKey = true
    }
    const createRes = await fetch("/api/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(createBody)
    })
    if (!createRes.ok) {
      setPending(false)
      const txt = await createRes.text()
      toast.error("Create failed: " + txt.slice(0, 100))
      return
    }
    const createJson = await createRes.json()
    const newId = createJson?.doc?.id ?? createJson?.id

    if (v.enableAPIKey && newId != null) {
      // Step 2: PATCH the new user with a generated API key.
      const apiKey = crypto.randomUUID()
      const patchRes = await fetch(`/api/users/${newId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apiKey })
      })
      setPending(false)
      if (!patchRes.ok) {
        const txt = await patchRes.text()
        toast.error("User created, but API key set failed: " + txt.slice(0, 80))
        // Still show what we tried so the operator can retry the PATCH manually
        setCreatedKey({ apiKey: "(failed to set — open the user record and regenerate)", email: v.email })
        return
      }
      setCreatedKey({ apiKey, email: v.email })
    } else {
      setPending(false)
      toast.success("User created")
      setOpen(false)
      form.reset()
      router.refresh()
    }
  }

  const dismissKey = () => {
    setCreatedKey(null)
    setOpen(false)
    form.reset()
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={(b) => { setOpen(b); if (!b) { setCreatedKey(null); form.reset() } }}>
      <DialogTrigger asChild>
        <Button type="button"><Plus className="mr-1 h-4 w-4"/> Create user</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{createdKey ? "User created" : "Create user"}</DialogTitle>
        </DialogHeader>

        {createdKey ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              <strong>{createdKey.email}</strong> is created. Copy this API key now — it won't be shown again.
            </p>
            <div className="flex items-center gap-2 rounded-md border bg-muted p-2">
              <code className="text-xs flex-1 break-all">{createdKey.apiKey}</code>
              <Button variant="outline" size="sm" type="button"
                onClick={() => { navigator.clipboard.writeText(createdKey.apiKey); toast.success("Copied") }}>
                <Copy className="h-3 w-3"/>
              </Button>
            </div>
            <Button onClick={dismissKey} className="w-full">Done</Button>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-3">
              <FormField name="email" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      autoCapitalize="off"
                      autoCorrect="off"
                      spellCheck={false}
                      enterKeyHint="next"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage/>
                </FormItem>
              )}/>
              <FormField name="name" control={form.control} render={({ field }) => (
                <FormItem><FormLabel>Name</FormLabel><FormControl><Input autoComplete="name" enterKeyHint="next" {...field}/></FormControl><FormMessage/></FormItem>
              )}/>
              <FormField name="password" control={form.control} render={({ field }) => (
                <FormItem><FormLabel>Password</FormLabel><FormControl><Input type="password" autoComplete="new-password" enterKeyHint="next" {...field}/></FormControl><FormMessage/></FormItem>
              )}/>
              <FormField name="role" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="super-admin">Super-admin</SelectItem>
                      <SelectItem value="owner">Owner</SelectItem>
                      <SelectItem value="editor">Editor</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage/>
                </FormItem>
              )}/>
              {role !== "super-admin" && (
                <FormField name="tenantId" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tenant</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select tenant"/></SelectTrigger></FormControl>
                      <SelectContent>
                        {tenants.map((t) => (
                          <SelectItem key={String(t.id)} value={String(t.id)}>{t.name} ({t.slug})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage/>
                  </FormItem>
                )}/>
              )}
              <FormField name="enableAPIKey" control={form.control} render={({ field }) => (
                <FormItem className="flex items-center justify-between">
                  <FormLabel>Enable API key</FormLabel>
                  <FormControl><Switch checked={!!field.value} onCheckedChange={field.onChange}/></FormControl>
                </FormItem>
              )}/>
              {enableAPIKey && (
                <p className="text-xs text-muted-foreground">A unique key will be generated and shown once after save.</p>
              )}
              <Button type="submit" disabled={pending} className="w-full">
                {pending ? "Creating..." : "Create user"}
              </Button>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  )
}
