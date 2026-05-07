"use client"
import type { Control } from "react-hook-form"
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Props = {
  control: Control<any>
  pending: boolean
  variant?: "card" | "bare"
}

/**
 * Publish controls — Status select + Save button. Used in two contexts:
 *   - variant="card"  → inside the Publish card in hidden/grid mode (shows "Status" label)
 *   - variant="bare"  → in the sticky TopBar in side mode (no label, compact)
 *
 * Field name "status" and option values "draft"/"published" mirror the zod
 * schema and existing inline JSX in PageForm.
 */
export function PublishControls({ control, pending, variant = "card" }: Props) {
  return (
    <div className={cn(
      "flex items-end gap-2",
      variant === "bare" && "shrink-0"
    )}>
      <FormField
        control={control}
        name="status"
        render={({ field }) => (
          <FormItem className={cn("min-w-0", variant === "card" ? "flex-1" : "min-w-[140px]")}>
            {variant === "card" && <FormLabel>Status</FormLabel>}
            <FormControl>
              <Select onValueChange={field.onChange} value={field.value ?? "draft"}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                </SelectContent>
              </Select>
            </FormControl>
            {variant === "card" && <FormMessage />}
          </FormItem>
        )}
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Save"}
      </Button>
    </div>
  )
}
