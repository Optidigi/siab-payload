"use client"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { inviteUser } from "@/lib/actions/inviteUser"

const schema = z.object({
  email: z.string().email("Enter a valid email address"),
  name: z.string().min(1, "Name is required"),
  role: z.enum(["owner", "editor", "viewer"], {
    message: "Select a role"
  })
})
type V = z.infer<typeof schema>

export function UserInviteForm({ tenantId }: { tenantId: number | string }) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const router = useRouter()
  const form = useForm<V>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", name: "", role: "editor" }
  })

  const onSubmit = async (v: V) => {
    setPending(true)
    // FN-2026-0036 — inviteUser is a server action that THROWS on failure
    // (Forbidden, duplicate email, validation). Without try/catch the
    // exception propagates past `setPending(false)` and the button stays
    // disabled in "Sending..." state forever. Wrap and surface a toast.
    try {
      const res = await inviteUser({ ...v, tenantId })
      if (!res.ok) {
        // Distinguish field-level error from generic; surface inline if
        // the server returned a path. Today inviteUser returns { ok, error?, field? } shape.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r = res as any
        if (r.field === "email" || r.field === "name") {
          form.setError(r.field as "email" | "name", { message: r.error || "Invalid" })
          toast.error(`${r.field}: ${r.error || "Invalid"}`)
        } else {
          toast.error(r.error || "Invite failed")
        }
        return
      }
      toast.success("Invitation sent")
      setOpen(false)
      form.reset()
      router.refresh()
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invite failed"
      toast.error(msg)
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button"><Plus className="mr-1 h-4 w-4" /> Invite</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite team member</DialogTitle>
          <DialogDescription>
            Send an invitation email to add a new member to this tenant. They&apos;ll set their own password on first login.
          </DialogDescription>
        </DialogHeader>
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
                <FormMessage />
              </FormItem>
            )} />
            <FormField name="name" control={form.control} render={({ field }) => (
              <FormItem><FormLabel>Name</FormLabel><FormControl><Input enterKeyHint="next" autoComplete="name" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField name="role" control={form.control} render={({ field }) => (
              <FormItem>
                <FormLabel>Role</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="owner">Owner</SelectItem>
                    <SelectItem value="editor">Editor</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <Button type="submit" disabled={pending}>{pending ? "Sending..." : "Send invite"}</Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
