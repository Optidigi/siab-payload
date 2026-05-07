"use client"
import { useFormContext, Controller } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form"
import { MediaPicker } from "@/components/media/MediaPicker"

type AnyField = any

export function FieldRenderer({ field, namePrefix = "" }: { field: AnyField; namePrefix?: string }) {
  const fieldName = field.name ? (namePrefix ? `${namePrefix}.${field.name}` : field.name) : namePrefix
  const { control } = useFormContext()

  switch (field.type) {
    case "text":
    case "email":
      return (
        <FormField control={control} name={fieldName} render={({ field: f }) => (
          <FormItem>
            <FormLabel>{field.label ?? field.name}{field.required && "*"}</FormLabel>
            <FormControl>
              {field.type === "email" ? (
                <Input
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  {...f}
                  value={f.value ?? ""}
                />
              ) : (
                <Input type="text" {...f} value={f.value ?? ""} />
              )}
            </FormControl>
            {field.admin?.description && <FormDescription>{field.admin.description}</FormDescription>}
            <FormMessage />
          </FormItem>
        )}/>
      )
    case "textarea":
    case "richText":
      return (
        <FormField control={control} name={fieldName} render={({ field: f }) => (
          <FormItem>
            <FormLabel>{field.label ?? field.name}{field.required && "*"}</FormLabel>
            <FormControl><Textarea rows={field.type === "richText" ? 8 : 4} {...f} value={f.value ?? ""} /></FormControl>
            <FormMessage />
          </FormItem>
        )}/>
      )
    case "number":
      return (
        <FormField control={control} name={fieldName} render={({ field: f }) => (
          <FormItem>
            <FormLabel>{field.label ?? field.name}</FormLabel>
            <FormControl><Input type="number" {...f} value={f.value ?? ""} onChange={(e) => f.onChange(e.target.valueAsNumber)} /></FormControl>
            <FormMessage />
          </FormItem>
        )}/>
      )
    case "checkbox":
      return (
        <FormField control={control} name={fieldName} render={({ field: f }) => (
          <FormItem className="flex items-center justify-between gap-3">
            <FormLabel>{field.label ?? field.name}</FormLabel>
            <FormControl><Switch checked={!!f.value} onCheckedChange={f.onChange} /></FormControl>
          </FormItem>
        )}/>
      )
    case "select":
      return (
        <FormField control={control} name={fieldName} render={({ field: f }) => (
          <FormItem>
            <FormLabel>{field.label ?? field.name}</FormLabel>
            <Select value={f.value ?? ""} onValueChange={f.onChange}>
              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
              <SelectContent>
                {field.options.map((opt: any) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}/>
      )
    case "upload":
      return (
        <Controller name={fieldName} control={control} render={({ field: f }) => (
          <FormItem>
            <FormLabel>{field.label ?? field.name}</FormLabel>
            <FormControl><MediaPicker value={f.value} onChange={f.onChange} relationTo={field.relationTo}/></FormControl>
            <FormMessage />
          </FormItem>
        )}/>
      )
    case "group":
      return (
        <fieldset className="rounded-md border p-3 space-y-3">
          <legend className="px-1 text-sm font-medium">{field.label ?? field.name}</legend>
          {field.fields.map((sub: AnyField, i: number) => (
            <FieldRenderer key={i} field={sub} namePrefix={fieldName} />
          ))}
        </fieldset>
      )
    case "array":
      return <ArrayFieldRenderer field={field} namePrefix={fieldName} />
    default:
      return <div className="text-xs text-muted-foreground">Unsupported field type: {String(field.type)}</div>
  }
}

function ArrayFieldRenderer({ field, namePrefix }: { field: any; namePrefix: string }) {
  const { getValues, setValue } = useFormContext()
  const items: any[] = getValues(namePrefix) ?? []

  const append = () => setValue(namePrefix, [...items, {}], { shouldDirty: true })
  const removeAt = (i: number) => setValue(namePrefix, items.filter((_, j) => j !== i), { shouldDirty: true })

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium">{field.label ?? field.name}</div>
      {items.map((_, i) => (
        <div key={i} className="rounded-md border p-3 max-md:p-2 max-md:space-y-2 space-y-3 relative">
          <button type="button" className="absolute top-2 right-2 text-xs text-muted-foreground hover:text-foreground" onClick={() => removeAt(i)}>Remove</button>
          {field.fields.map((sub: any, j: number) => (
            <FieldRenderer key={j} field={sub} namePrefix={`${namePrefix}.${i}`} />
          ))}
        </div>
      ))}
      <button type="button" className="text-xs text-primary underline" onClick={append}>+ Add {field.singularLabel ?? "item"}</button>
    </div>
  )
}
