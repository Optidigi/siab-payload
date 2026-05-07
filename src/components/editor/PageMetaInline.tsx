"use client"
import { useRef } from "react"
import type { Control } from "react-hook-form"
import { FormField, FormItem, FormControl, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

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
        render={({ field, fieldState }) => {
          // Wrap a real shadcn <Input> so we keep aria-invalid styling,
          // dark-mode bg, data-slot hooks etc. The leading `/` is rendered
          // as an absolutely-positioned overlay so the underlying input
          // owns all interaction (focus ring, selection, placeholder).
          // Wrapper-level mousedown forwards click-on-`/` to the input.
          const inputRef = useRef<HTMLInputElement | null>(null)
          return (
            <FormItem className="w-48 shrink-0">
              <FormControl>
                <div
                  className="relative"
                  title="URL path. Lowercase, digits, hyphens."
                  onMouseDown={(e) => {
                    if (e.target === e.currentTarget) {
                      e.preventDefault()
                      inputRef.current?.focus()
                    }
                  }}
                >
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm text-muted-foreground"
                  >
                    /
                  </span>
                  <Input
                    {...field}
                    ref={(el) => {
                      inputRef.current = el
                      if (typeof field.ref === "function") field.ref(el)
                    }}
                    placeholder="slug"
                    value={field.value ?? ""}
                    aria-invalid={fieldState.invalid || undefined}
                    className={cn("pl-6")}
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )
        }}
      />
    </div>
  )
}
