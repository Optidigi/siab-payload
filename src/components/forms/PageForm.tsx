"use client"
import { useEffect, useMemo, useRef, useState } from "react"
import { useForm, type FieldErrors } from "react-hook-form"
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
import { SaveStatusBar, type SaveStatus, type PreviewMode } from "@/components/editor/SaveStatusBar"
import { PreviewPane } from "@/components/editor/PreviewPane"
import type { PreviewStatus } from "@/components/editor/PreviewToolbar"
import { SplitDivider } from "@/components/editor/SplitDivider"
import { MobileTabbar } from "@/components/editor/MobileTabbar"
import { useNavigationGuard } from "@/components/editor/useNavigationGuard"
import { UnsavedChangesDialog } from "@/components/editor/UnsavedChangesDialog"
import { TypedConfirmDialog } from "@/components/shared/TypedConfirmDialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { parsePayloadError } from "@/lib/api"
import { scrollToFirstError } from "@/lib/formScroll"
import { toast } from "sonner"
import { Trash2, ChevronUp, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Page } from "@/payload-types"

/**
 * SSR-safe `(min-width: 768px)` media query hook. Defaults to `false` on
 * the first render so the mobile-only layout renders identically on
 * server and client (no hydration mismatch). Once mounted, listens for
 * matchMedia changes so a DevTools resize flips state without a refresh.
 */
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)")
    setIsDesktop(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])
  return isDesktop
}

/**
 * Payload upload fields accept either a numeric id or null. The form may
 * hold a fully populated Media object after a fetched page is loaded
 * with depth>=1. Normalize back to id (or null) before submit so we
 * don't trip a Payload v3.84.1 upstream bug in beforeValidate where
 * parseFloat(<object>) returns NaN and validation rejects the field.
 *
 * Any non-primitive shape that ISN'T `{ id, ... }` collapses to null —
 * sending `{}` or any malformed object would re-trigger the same upstream
 * parseFloat-over-object → NaN path we're working around.
 */
const normalizeUploadId = (v: unknown): number | string | null => {
  if (v == null) return null
  if (typeof v === "object") {
    const id = (v as { id?: unknown }).id
    if (typeof id === "number" || typeof id === "string") return id
    return null
  }
  if (typeof v === "number" || typeof v === "string") return v
  return null
}

const schema = z.object({
  title: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9-]+$/, "Lowercase, digits, hyphens only"),
  status: z.enum(["draft", "published"]),
  blocks: z.array(z.any()),
  // `.nullish()` (T | null | undefined) is load-bearing — Postgres returns
  // `null` for unset optional text columns inside groups, and `payload-types`
  // declares `seo.title?: string | null`. With plain `.optional()` (T |
  // undefined only) zod rejects those nulls on second save: a fresh page
  // post-create has `defaultValues.seo = {title: null, description: null,
  // ogImage: null}` — the parent `??` short-circuit doesn't dig into the
  // children — and `handleSubmit` short-circuits to `onInvalid` before any
  // network call, lighting both text fields red. ogImage uses `z.any()`
  // which already tolerates null, but standardise on `.nullish()` so the
  // intent is uniform across the group.
  seo: z.object({
    title: z.string().nullish(),
    description: z.string().nullish(),
    ogImage: z.any().nullish()
  }).nullish()
})
type Values = z.infer<typeof schema>

const seoFields = [
  { name: "title", type: "text", label: "SEO title" },
  { name: "description", type: "textarea", label: "SEO description" },
  { name: "ogImage", type: "upload", relationTo: "media", label: "Open Graph image" }
]

export function PageForm({ initial, tenantId, baseHref, tenantOrigin }: { initial?: Page; tenantId: number | string; baseHref: string; tenantOrigin: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const [previewMode, setPreviewMode] = useState<PreviewMode>(() => {
    if (typeof window === "undefined") return "hidden"
    const stored = window.localStorage.getItem("page-editor:preview-mode")
    return stored === "side" || stored === "fullscreen" ? stored : "hidden"
  })
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("page-editor:preview-mode", previewMode)
    }
  }, [previewMode])

  // Split percentage: how much of the editor-area width the preview
  // occupies in side mode. Lazy initializer mirrors `previewMode`
  // above — read localStorage once on mount; clamp to [20, 50] so a
  // corrupted value (or one persisted from the old [20,80] range)
  // can never wedge the layout. 40 is the default split — leans the
  // editor a bit wider than the preview so form fields stay readable.
  const [splitPct, setSplitPct] = useState<number>(() => {
    if (typeof window === "undefined") return 40
    const stored = window.localStorage.getItem("page-editor:preview-split")
    const n = stored ? Number(stored) : NaN
    return Number.isFinite(n) && n >= 20 && n <= 50 ? n : 40
  })
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("page-editor:preview-split", String(splitPct))
    }
  }, [splitPct])
  const [isDragging, setIsDragging] = useState(false)
  const previewWrapperRef = useRef<HTMLDivElement>(null)
  const formContainerRef = useRef<HTMLDivElement>(null)

  // Phone sheet drag — tracks pointer state outside of React state so
  // the move handler can mutate the transform synchronously without a
  // rerender per frame. The sheet element is the same `previewWrapperRef`
  // div used for the desktop side preview (one wrapper, mode-swapped
  // styling) so we don't need a second ref. `lastFocusedFieldRef` is
  // what we scroll back into view when the operator collapses to peek.
  const sheetDragStateRef = useRef<{
    startY: number
    startState: "peek" | "full"
    lastDeltaY: number
  } | null>(null)
  const [isSheetDragging, setIsSheetDragging] = useState(false)
  const lastFocusedFieldRef = useRef<HTMLElement | null>(null)

  // Lifted preview lifecycle state. Owned here so siblings (mobile
  // tabbar, desktop save bar) can observe the preview status without
  // mounting an extra <PreviewPane> instance.
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>("loading")
  const [previewErrorMessage, setPreviewErrorMessage] = useState<string | undefined>()
  const [previewIsSlowLoad, setPreviewIsSlowLoad] = useState(false)

  // Phone bottom-sheet state. NOT persisted in localStorage — the
  // operator decision is per-session. Defaults to closed so a phone
  // user lands on a clean editor.
  const [previewSheetState, setPreviewSheetState] = useState<"closed" | "peek" | "full">("closed")

  const isDesktop = useIsDesktop()

  // Cross-pane focus state. focusin in PageForm's <form> sets the focused
  // block index; PreviewPane forwards it to the iframe via postMessage.
  // focusSeqRef monotonically increments so the iframe can ignore stale
  // messages — necessary because the user can rapidly tab through fields.
  const [focusedBlockIndex, setFocusedBlockIndex] = useState<number | null>(null)
  const [focusSeq, setFocusSeq] = useState(0)
  const focusSeqRef = useRef(0)
  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null
      if (!target) return
      // shadcn Select trigger is a <button> without a `name` — read it via
      // closest("[name]") so any nested input inside a labelled wrapper
      // still resolves.
      const named = target.closest("[name]") as HTMLElement | null
      // Track the most recent named field globally so the phone sheet
      // can scroll it back into view on peek-collapse. Captures every
      // field, not just blocks.<n>.* like the cross-pane sync below.
      if (named) lastFocusedFieldRef.current = named
      const name = named?.getAttribute("name") ?? ""
      // Anchored regex so `seo.*`, bare `blocks`, `pages.0.blocks.…` (non-
      // anchored) etc. don't match — only top-level `blocks.<n>.…`.
      const m = /^blocks\.(\d+)\./.exec(name)
      const captured = m?.[1]
      if (captured) {
        const idx = parseInt(captured, 10)
        if (!Number.isNaN(idx)) {
          focusSeqRef.current += 1
          setFocusSeq(focusSeqRef.current)
          setFocusedBlockIndex(idx)
        }
      }
    }
    document.addEventListener("focusin", onFocusIn)
    return () => document.removeEventListener("focusin", onFocusIn)
  }, [])

  // When the sheet collapses to peek, scroll the last-focused field
  // into the editor's center so the operator can keep typing without
  // hunting. Skipped on closed/full transitions — full hides the
  // editor entirely and closed leaves the editor where it is.
  useEffect(() => {
    if (previewSheetState !== "peek") return
    const el = lastFocusedFieldRef.current
    if (!el) return
    el.scrollIntoView({ block: "center", behavior: "smooth" })
  }, [previewSheetState])

  // Iframe → admin: scroll the editor row for the clicked block + focus
  // its first input. Querying by `[name^="blocks.<n>."]` works because
  // RHF + react-hook-form's Controller registers fields with that exact
  // name shape.
  const handleClickBlock = (index: number) => {
    const firstInput = document.querySelector(
      `[name^="blocks.${index}."]`,
    ) as HTMLElement | null
    if (firstInput) {
      firstInput.scrollIntoView({ behavior: "smooth", block: "center" })
      firstInput.focus({ preventScroll: true })
    }
  }

  // Stable draft session id for unsaved Pages (no real id yet).
  const draftSessionId = useMemo(() => {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID()
    }
    return Math.random().toString(36).slice(2)
  }, [])
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: initial
      ? { title: initial.title, slug: initial.slug ?? "", status: (initial.status as "draft" | "published") ?? "draft",
          blocks: (initial.blocks as any) ?? [], seo: (initial.seo as any) ?? {} }
      : { title: "", slug: "", status: "draft", blocks: [], seo: {} }
  })

  // Guard against accidental tab close / refresh / off-site nav while the
  // form has unsaved work or a save is in flight. Headless hook —
  // pairs with <UnsavedChangesDialog/> below for the in-app + popstate
  // confirms.
  const guard = useNavigationGuard(form.formState.isDirty || pending)

  const onSubmit = async (values: Values) => {
    setPending(true)
    setSubmitError(null)
    const url = initial ? `/api/pages/${initial.id}` : "/api/pages"
    const method = initial ? "PATCH" : "POST"
    // Normalize ogImage to a bare id so Payload's beforeValidate hook
    // doesn't choke on a populated Media object — see normalizeUploadId.
    const body = JSON.stringify({
      ...values,
      tenant: tenantId,
      seo: values.seo
        ? { ...values.seo, ogImage: normalizeUploadId(values.seo.ogImage) }
        : values.seo,
    })
    let res: Response
    try {
      res = await fetch(url, { method, headers: { "content-type": "application/json" }, body })
    } catch (e) {
      setPending(false)
      const msg = e instanceof Error ? e.message : "Network error"
      setSubmitError(msg)
      toast.error("Save failed")
      return
    }
    setPending(false)
    if (!res.ok) {
      // Drill into Payload's error envelope so a slug-regex / unique
      // conflict / required-field error lights up the offending field
      // instead of bubbling up as an opaque "HTTP 400".
      const detail = await parsePayloadError(res)
      if (detail.field) {
        // RHF accepts dotted paths (e.g. "seo.title"). Cast widens to any
        // because `keyof Values` is only the top-level keys, but RHF's
        // runtime accepts the full FieldPath. Matches the pattern in
        // TenantEditForm/UserEditForm for consistency.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        form.setError(detail.field as any, {
          type: "server",
          message: detail.message
        })
        // setError mutates the errors object synchronously, but defer
        // the scroll to next frame so RHF has flushed re-renders that
        // would otherwise move the field's DOM position out from under
        // us.
        requestAnimationFrame(() => scrollToFirstError(form.formState.errors))
      }
      setSubmitError(detail.message)
      toast.error(`Save failed: ${detail.message}`)
      return
    }
    setSubmitError(null)
    setLastSavedAt(Date.now())
    // Reset RHF dirty state to the just-saved values so SaveStatusBar
    // transitions out of "dirty" once the save lands.
    form.reset(values, { keepValues: true })
    toast.success(values.status === "published" ? "Published" : "Saved")
    if (!initial) {
      const json = await res.json()
      const newId = json.doc?.id ?? json.id
      router.replace(`${baseHref}/${newId}`)
    } else {
      router.refresh()
    }
  }

  // RHF calls onInvalid when zod validation fails before onSubmit ever
  // runs. Jump the user to the first offending field.
  const onInvalid = (errors: FieldErrors<Values>) => {
    scrollToFirstError(errors as Record<string, unknown>)
  }

  const retry = () => form.handleSubmit(onSubmit, onInvalid)()
  const triggerSave = () => form.handleSubmit(onSubmit, onInvalid)()
  const jumpToError = () =>
    scrollToFirstError(form.formState.errors as Record<string, unknown>)

  const onDelete = async () => {
    if (!initial) return
    const res = await fetch(`/api/pages/${initial.id}`, { method: "DELETE" })
    if (!res.ok) {
      const detail = await parsePayloadError(res)
      throw new Error(detail.message)
    }
    // Clear dirty so the navigation guard doesn't fire on the post-
    // delete redirect. router.replace is programmatic so the click
    // guard wouldn't fire anyway, but if a future code path adds a
    // guard between here and the redirect, this keeps the state
    // machine coherent. Belt-and-braces.
    form.reset(form.getValues(), { keepValues: true })
    toast.success(`Deleted ${initial.title}`)
    router.replace(baseHref)
    router.refresh()
  }

  // Compute save status for the pill. "idle" means: not dirty AND
  // nothing saved yet — keeps the pill hidden on initial render.
  // Validation errors take precedence over dirty so the operator sees
  // why their save was blocked.
  const isDirty = form.formState.isDirty
  const errorCount = Object.keys(form.formState.errors).length
  const dirtyCount = Object.keys(form.formState.dirtyFields).length
  let saveStatus: SaveStatus = "idle"
  if (pending) saveStatus = "saving"
  else if (errorCount > 0) saveStatus = "error"
  else if (submitError) saveStatus = "error"
  else if (isDirty) saveStatus = "dirty"
  else if (lastSavedAt) saveStatus = "saved"

  // Map the SaveStatus union → MobileTabbar's narrower dot status.
  // "idle" maps to "saved" so a never-edited form shows the neutral
  // muted dot rather than implying anything.
  const tabbarSaveStatus: "saved" | "unsaved" | "saving" | "error" =
    saveStatus === "saving"
      ? "saving"
      : saveStatus === "error"
      ? "error"
      : saveStatus === "dirty"
      ? "unsaved"
      : "saved"

  // Map the PreviewStatus union → MobileTabbar's dot status. The
  // tabbar's "not-loaded" reads as a passive grey when the operator
  // hasn't opened the sheet yet — we surface it as "live" once
  // PreviewPane reports `ready`, and pulse amber while loading or
  // reconnecting.
  const tabbarPreviewStatus: "live" | "loading" | "reconnecting" | "error" | "not-loaded" =
    previewSheetState === "closed" && previewStatus === "loading"
      ? "not-loaded"
      : previewStatus === "ready"
      ? "live"
      : previewStatus === "loading"
      ? "loading"
      : previewStatus === "reconnecting"
      ? "reconnecting"
      : "error"

  const onTapEdit = () => setPreviewSheetState("closed")
  const onTapPreview = () =>
    setPreviewSheetState((s) => (s === "closed" ? "peek" : s === "peek" ? "full" : "closed"))

  // Phone sheet drag handlers. We drive the transform imperatively
  // during the drag so it tracks the finger 1:1; on release we
  // restore the CSS transition and let the React-state-driven
  // transform animate to the chosen rest state.
  const onSheetDragStart = (e: React.PointerEvent) => {
    if (previewSheetState === "closed") return
    e.preventDefault()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    sheetDragStateRef.current = {
      startY: e.clientY,
      startState: previewSheetState,
      lastDeltaY: 0,
    }
    setIsSheetDragging(true)
  }
  const onSheetDragMove = (e: React.PointerEvent) => {
    const drag = sheetDragStateRef.current
    if (!drag) return
    const deltaY = e.clientY - drag.startY
    drag.lastDeltaY = deltaY
    if (previewWrapperRef.current) {
      const baseTranslate =
        drag.startState === "full" ? 0 : window.innerHeight * 0.4
      previewWrapperRef.current.style.transition = "none"
      previewWrapperRef.current.style.transform = `translateY(${baseTranslate + deltaY}px)`
    }
  }
  const onSheetDragEnd = (e: React.PointerEvent) => {
    const drag = sheetDragStateRef.current
    if (!drag) return
    ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    const deltaY = drag.lastDeltaY
    const threshold = window.innerHeight * 0.25
    let next: "closed" | "peek" | "full"
    if (drag.startState === "full") {
      next = deltaY > threshold ? "peek" : "full"
    } else {
      if (deltaY < -threshold) next = "full"
      else if (deltaY > threshold) next = "closed"
      else next = "peek"
    }
    sheetDragStateRef.current = null
    setIsSheetDragging(false)
    if (previewWrapperRef.current) {
      // Clear inline transform/transition so the React-state-driven
      // transform takes over.
      previewWrapperRef.current.style.transition = ""
      previewWrapperRef.current.style.transform = ""
    }
    setPreviewSheetState(next)
  }

  // Desktop side mode renders the preview as an in-flow flex column
  // sibling of the editor; in any other mode the preview wrapper is
  // either hidden or absolutely positioned, so it doesn't take a
  // flex-basis slot.
  const showSideInFlow = isDesktop && previewMode === "side"
  const isPhoneSheetOpen = !isDesktop && previewSheetState !== "closed"

  // Wrapper className/style for the single PreviewPane mount. The
  // wrapper element stays at the SAME React tree position across all
  // modes — only its className/style change. That's load-bearing
  // because each remount loses heartbeat state, signed-token age,
  // scroll position, and mid-typing debounce timers.
  const previewWrapperClass = cn(
    "flex flex-col",
    isDesktop && previewMode === "hidden" && "hidden",
    showSideInFlow && "self-stretch min-w-0 border-l bg-background",
    isDesktop && previewMode === "fullscreen" &&
      "fixed inset-0 bg-background z-40",
    !isDesktop && previewSheetState === "closed" && "hidden",
    // Phone peek/full: full-viewport-height sheet whose `transform`
    // (computed below) shifts it down to reveal the editor for peek
    // and slides off-screen for closed. The tabbar's bottom-pad
    // (~56px + safe-area) is handled inside the wrapper via
    // padding-bottom so the iframe content doesn't sit under the
    // tabbar.
    isPhoneSheetOpen &&
      "fixed inset-x-0 bottom-0 z-40 bg-background border-t shadow-2xl rounded-t-2xl overflow-hidden",
  )
  const previewWrapperStyle: React.CSSProperties | undefined = showSideInFlow
    ? {
        flex: `0 0 ${splitPct}%`,
        transition: isDragging ? "none" : "flex-basis 80ms ease-out",
      }
    : isPhoneSheetOpen
    ? {
        height: "100dvh",
        transform:
          previewSheetState === "full"
            ? "translateY(0)"
            : previewSheetState === "peek"
            ? "translateY(40dvh)"
            : "translateY(100dvh)",
        transition: isSheetDragging ? "none" : "transform 300ms ease-out",
        // Tabbar height + safe area so iframe content isn't hidden
        // behind the tabbar at the bottom of the screen.
        paddingBottom: "calc(56px + env(safe-area-inset-bottom))",
      }
    : undefined

  const previewPane = (
    <PreviewPane
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      control={form.control as unknown as import("react-hook-form").Control<any>}
      tenantId={tenantId}
      tenantOrigin={tenantOrigin}
      pageId={initial?.id ?? `draft-${draftSessionId}`}
      previewMode={previewMode}
      setPreviewMode={setPreviewMode}
      focusedBlockIndex={focusedBlockIndex}
      focusSeq={focusSeq}
      onClickBlock={handleClickBlock}
      status={previewStatus}
      setStatus={setPreviewStatus}
      errorMessage={previewErrorMessage}
      setErrorMessage={setPreviewErrorMessage}
      isSlowLoad={previewIsSlowLoad}
      setIsSlowLoad={setPreviewIsSlowLoad}
    />
  )

  return (
    <Form {...form}>
      <div ref={formContainerRef} className="flex w-full">
        <form
          onSubmit={form.handleSubmit(onSubmit, onInvalid)}
          className="flex-1 min-w-0"
        >
          {/*
            Container queries on the editor area so the inner Page +
            Publish/SEO grid stacks based on its OWN width, not the
            viewport. When the side preview takes 50% of a 1280px
            viewport the editor area shrinks to 640px — at that width
            we want the inner cards stacked, even though the global
            viewport is still well past `lg`. lg-breakpoint media queries
            can't see container width.
          */}
          <div className="@container/editor">
            <div className="grid grid-cols-1 @[800px]/editor:grid-cols-3 gap-4">
              <div className="@[800px]/editor:col-span-2 space-y-4">
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
                  <CardContent><BlockEditor tenantId={tenantId}/></CardContent>
                </Card>
              </div>
              {/*
                Stacked-mode separator. Only shows when the editor area
                is below 800px (single-column inner grid) — adds a
                visual divider + "Settings" heading so Publish/SEO
                doesn't run straight into Blocks. Hidden once the inner
                grid switches back to 3-col side-by-side.
              */}
              <div className="@[800px]/editor:hidden border-t pt-4">
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">Settings</h3>
              </div>
              <div className="space-y-4">
                <Card>
                  <CardHeader><CardTitle>Publish</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {/*
                      Inline Status select + Save button so the primary
                      action sits next to the state it commits. DOM
                      order is Select → Button so keyboard tab order
                      matches reading order; we deliberately don't use
                      `flex-row-reverse` for that reason. `items-end`
                      bottom-aligns the Button against the Select's
                      input row (its label sits above), avoiding the
                      taller Select feeling unbalanced.
                    */}
                    <div className="flex items-end gap-2">
                      <div className="flex-1 min-w-0">
                        <FormField control={form.control} name="status" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Status</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <FormControl><SelectTrigger className="w-full"><SelectValue/></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="draft">Draft</SelectItem>
                                <SelectItem value="published">Published</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage/>
                          </FormItem>
                        )}/>
                      </div>
                      <Button type="submit" disabled={pending}>
                        {pending ? "Saving..." : "Save"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle>SEO</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {seoFields.map((f, i) => <FieldRenderer key={i} field={f} namePrefix="seo"/>)}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </form>
        {showSideInFlow && (
          <SplitDivider
            pct={splitPct}
            setPct={setSplitPct}
            iframeWrapperRef={previewWrapperRef}
            containerRef={formContainerRef}
            isDragging={isDragging}
            setIsDragging={setIsDragging}
          />
        )}
        {/*
          Phone-sheet backdrop. Sibling of the sheet so a tap can close
          it without intercepting events on the iframe. `inert` keeps
          form fields behind the peek sheet unfocusable, so a stray
          tap on (visible-but-occluded) editor controls doesn't yank
          focus while the sheet is up.
        */}
        {isPhoneSheetOpen && (
          <div
            // React 19 / current DOM accept the boolean form of inert.
            // @ts-expect-error inert is a valid HTMLAttribute in React 19+
            inert={previewSheetState !== "closed" ? "" : undefined}
            className="fixed inset-0 z-30 bg-black/30 transition-opacity duration-300 md:hidden"
            onClick={() => setPreviewSheetState("closed")}
            aria-hidden
          />
        )}
        {/*
          Single PreviewPane mount. The wrapper class/style swaps based
          on breakpoint × mode but the wrapper element itself stays at
          the SAME position in the React tree across all modes — that's
          load-bearing because each remount loses heartbeat state,
          signed-token age, scroll position, and mid-typing debounce
          timers. When not in side mode the wrapper is positioned
          `fixed` (or `display:none`), so it visually escapes this flex
          row but keeps its identity in React reconciliation. Token
          rotation (forceRefresh) still remounts via
          `key={tokenState.token}` inside PreviewPane.
        */}
        <div
          ref={previewWrapperRef}
          className={previewWrapperClass}
          style={previewWrapperStyle}
        >
          {isPhoneSheetOpen && (
            <>
              {/* Drag handle (the visible "pill" at the top of the sheet). */}
              <button
                type="button"
                onPointerDown={onSheetDragStart}
                onPointerMove={onSheetDragMove}
                onPointerUp={onSheetDragEnd}
                onPointerCancel={onSheetDragEnd}
                className="flex justify-center py-2 cursor-grab active:cursor-grabbing touch-none"
                aria-label="Drag to resize preview"
              >
                <span className="h-1.5 w-10 rounded-full bg-muted-foreground/30" />
              </button>
              {/* Sheet header — chevron toggles between peek and full. */}
              <div className="flex items-center justify-end gap-1 px-3 pb-2">
                {previewSheetState === "peek" ? (
                  <button
                    type="button"
                    onClick={() => setPreviewSheetState("full")}
                    aria-label="Expand preview to full"
                    className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPreviewSheetState("peek")}
                    aria-label="Collapse preview to peek"
                    className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                )}
              </div>
            </>
          )}
          {/*
            Inner pane container. Always rendered (so PreviewPane's
            position in the React tree is stable across breakpoint
            flips and never remounts) — its className just no-ops on
            non-phone modes. On phone, `flex-1 min-h-0` shares the
            sheet's height with the drag handle and header. On
            desktop the wrapper above sizes the pane directly so this
            container effectively `display: contents`.
          */}
          <div
            className={cn(
              "flex flex-col",
              isPhoneSheetOpen
                ? "flex-1 min-h-0 overflow-hidden"
                : "h-full",
            )}
          >
            {previewPane}
          </div>
        </div>
      </div>
      <SaveStatusBar
        status={saveStatus}
        dirtyCount={dirtyCount}
        errorCount={errorCount}
        onSave={triggerSave}
        onRetry={retry}
        onJumpToError={jumpToError}
        previewMode={previewMode}
        setPreviewMode={setPreviewMode}
      />
      <MobileTabbar
        saveStatus={tabbarSaveStatus}
        previewStatus={tabbarPreviewStatus}
        sheetState={previewSheetState}
        onTapEdit={onTapEdit}
        onTapPreview={onTapPreview}
      />
      <UnsavedChangesDialog
        open={guard.pending !== null}
        onCancel={guard.cancel}
        onConfirm={guard.confirm}
      />
      <section className="rounded-md border border-destructive/50 bg-destructive/5 p-4 mt-8">
        <h2 className="text-base font-semibold text-destructive">Danger zone</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {initial ? (
            <>
              Deleting page <strong>{initial.title}</strong> removes the page and any
              block content. Cannot be undone.
            </>
          ) : (
            <>Once saved, you can permanently delete this page from here.</>
          )}
        </p>
        {initial ? (
          <Button
            type="button"
            variant="destructive"
            className="mt-3"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete page
          </Button>
        ) : (
          <TooltipProvider>
            <Tooltip>
              {/* A disabled <Button> swallows pointer events, so wrap in a
                  span trigger so the tooltip still surfaces on hover/focus. */}
              <TooltipTrigger asChild>
                <span tabIndex={0} className="mt-3 inline-block">
                  <Button
                    type="button"
                    variant="destructive"
                    disabled
                    aria-disabled="true"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete page
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Save the page first to enable delete.</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </section>
      {initial && (
        <TypedConfirmDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title={`Delete ${initial.title}`}
          description={
            <>
              This will permanently delete the page <strong>{initial.title}</strong> and
              remove it from the live site. <strong>Cannot be undone.</strong>
            </>
          }
          confirmPhrase={initial.slug}
          confirmLabel="Delete page"
          onConfirm={onDelete}
        />
      )}
    </Form>
  )
}
