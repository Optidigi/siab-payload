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
              <Input placeholder="slug" {...field} value={field.value ?? ""} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}
