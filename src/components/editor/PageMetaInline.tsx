"use client"
import type { Control } from "react-hook-form"
import { FormField, FormItem, FormControl, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"

type Props = { control: Control<any> }

/**
 * Card-less Title + Slug fields for the sticky TopBar in side-preview mode.
 * Omits FormLabel so the TopBar stays compact. FormMessage is included so
 * validation errors (e.g. slug regex failure) are still visible inline.
 *
 * Field names and Input props mirror the existing PageForm hidden-mode cards
 * exactly — no extra autoComplete or onBlur beyond what spread-field provides.
 */
export function PageMetaInline({ control }: Props) {
  return (
    <div className="flex flex-1 min-w-0 items-end gap-3">
      <FormField
        control={control}
        name="title"
        render={({ field }) => (
          <FormItem className="flex-1 min-w-0">
            <FormControl>
              <Input placeholder="Page title" {...field} value={field.value ?? ""} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="slug"
        render={({ field }) => (
          <FormItem className="w-48 shrink-0">
            <FormControl>
              <div
                className="flex items-center h-9 rounded-md border border-input bg-transparent shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50"
                title="URL path. Lowercase, digits, hyphens."
              >
                <span className="pl-3 pr-1 text-sm text-muted-foreground select-none">/</span>
                <input
                  placeholder="slug"
                  {...field}
                  value={field.value ?? ""}
                  className="flex-1 min-w-0 bg-transparent py-1 pr-3 text-base md:text-sm outline-none placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}
