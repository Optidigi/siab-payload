"use client"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import type { Form as FormDoc } from "@/payload-types"

export function FormSubmissionSheet({
  form, open, onOpenChange
}: { form: FormDoc | null; open: boolean; onOpenChange: (b: boolean) => void }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  if (!form) return null

  const setStatus = (status: string) => start(async () => {
    const res = await fetch(`/api/forms/${form.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status })
    })
    if (!res.ok) { toast.error("Failed"); return }
    toast.success("Updated")
    router.refresh()
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:w-[560px] sm:max-w-[560px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{form.email ?? "Submission"}</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-4 text-sm">
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground">Status</span>
            <Select value={form.status as string} onValueChange={setStatus} disabled={pending}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["new", "read", "contacted", "spam"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><div className="text-muted-foreground">Form</div><div>{form.formName}</div></div>
          {form.pageUrl && <div><div className="text-muted-foreground">Page</div><div className="truncate">{form.pageUrl}</div></div>}
          <div><div className="text-muted-foreground">Name</div><div>{form.name ?? "—"}</div></div>
          <div><div className="text-muted-foreground">Email</div><div>{form.email ?? "—"}</div></div>
          <div><div className="text-muted-foreground">Message</div><pre className="whitespace-pre-wrap text-xs bg-muted p-2 rounded">{form.message ?? ""}</pre></div>
          <div>
            <div className="text-muted-foreground">Full payload</div>
            <pre className="whitespace-pre-wrap text-xs bg-muted p-2 rounded">{JSON.stringify(form.data, null, 2)}</pre>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
