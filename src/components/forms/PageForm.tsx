"use client"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useForm, type FieldErrors } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { BlockEditor } from "@/components/editor/BlockEditor"
import { FieldRenderer } from "@/components/editor/FieldRenderer"
import { SaveStatusBar, type SaveStatus, type PreviewMode } from "@/components/editor/SaveStatusBar"
import { PreviewPane } from "@/components/editor/PreviewPane"
import type { PreviewStatus } from "@/components/editor/PreviewToolbar"
import { SplitDivider } from "@/components/editor/SplitDivider"
import { PhonePreviewStrip } from "@/components/editor/PhonePreviewStrip"
import { PublishControls } from "@/components/editor/PublishControls"
import { PageMetaInline } from "@/components/editor/PageMetaInline"
import { useNavigationGuard } from "@/components/editor/useNavigationGuard"
import { UnsavedChangesDialog } from "@/components/editor/UnsavedChangesDialog"
import { TypedConfirmDialog } from "@/components/shared/TypedConfirmDialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { parsePayloadError } from "@/lib/api"
import { scrollToFirstError } from "@/lib/formScroll"
import { toast } from "sonner"
import { Trash2, ExternalLink, Copy, X, Save, Loader2 } from "lucide-react"
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

/**
 * Recursively count "leaf" errors (objects that carry a `message` or
 * `type` field) in a react-hook-form errors tree. Top-level
 * `Object.keys(errors).length` collapses all `blocks[*].field` errors
 * into a single key — useless once forms have nested arrays. Treat
 * arrays and plain objects as branches; everything else as a leaf.
 */
function countLeafErrors(node: unknown): number {
  if (!node || typeof node !== "object") return 0
  const obj = node as Record<string, unknown>
  if (typeof obj.message === "string" || typeof obj.type === "string") return 1
  let total = 0
  for (const v of Object.values(obj)) {
    if (Array.isArray(v)) {
      for (const item of v) total += countLeafErrors(item)
    } else if (v && typeof v === "object") {
      total += countLeafErrors(v)
    }
  }
  return total
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
  // occupies in side mode. Stored per-page so different pages can have
  // different splits; global key acts as a fallback for unsaved pages.
  // Clamp to [20, 60] — 40 is the default.
  const splitStorageKey = `page-editor:preview-split:${initial?.id ?? "new"}`
  const [splitPct, setSplitPct] = useState<number>(() => {
    if (typeof window === "undefined") return 40
    const perPage = window.localStorage.getItem(splitStorageKey)
    const global = window.localStorage.getItem("page-editor:preview-split")
    const raw = perPage ?? global
    if (!raw) return 40
    const n = parseInt(raw, 10)
    return Number.isFinite(n) && n >= 20 && n <= 60 ? n : 40
  })
  useEffect(() => {
    if (typeof window !== "undefined") {
      // Write per-page key for precise memory; also update the global key
      // so new pages inherit the last-used split as a sensible default.
      window.localStorage.setItem(splitStorageKey, String(splitPct))
      window.localStorage.setItem("page-editor:preview-split", String(splitPct))
    }
  }, [splitPct, splitStorageKey])
  const [isDragging, setIsDragging] = useState(false)
  const previewWrapperRef = useRef<HTMLDivElement>(null)
  const formContainerRef = useRef<HTMLDivElement>(null)

  const lastFocusedFieldRef = useRef<HTMLElement | null>(null)

  // Lifted preview lifecycle state. Owned here so siblings (mobile
  // tabbar, desktop save bar) can observe the preview status without
  // mounting an extra <PreviewPane> instance.
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>("loading")
  const [previewErrorMessage, setPreviewErrorMessage] = useState<string | undefined>()
  const [previewIsSlowLoad, setPreviewIsSlowLoad] = useState(false)

  // Phone preview overlay state. NOT persisted in localStorage — the
  // operator decision is per-session. Defaults to closed so a phone
  // user lands on a clean editor.
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)

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
  const triggerSave = useCallback(() => form.handleSubmit(onSubmit, onInvalid)(), [form, onSubmit, onInvalid])

  // Cmd+S / Ctrl+S global save shortcut. Skip when focus is inside an
  // open dialog so confirmation dialogs handle their own key events.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "s" || e.key === "S")) {
        const active = document.activeElement
        if (active && active.closest("[role='dialog']")) return
        e.preventDefault()
        triggerSave()
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [triggerSave])

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
  // Recursively count leaf error nodes — RHF nests errors as
  // { blocks: [{ headline: { message } }, ...] }, so a top-level
  // Object.keys() count would collapse all block errors to 1.
  const errorCount = countLeafErrors(form.formState.errors)
  const dirtyCount = Object.keys(form.formState.dirtyFields).length
  let saveStatus: SaveStatus = "idle"
  if (pending) saveStatus = "saving"
  else if (errorCount > 0) saveStatus = "error"
  else if (submitError) saveStatus = "error"
  else if (isDirty) saveStatus = "dirty"
  else if (lastSavedAt) saveStatus = "saved"


  // Desktop side mode renders the preview as an in-flow flex column
  // sibling of the editor; in any other mode the preview wrapper is
  // either hidden or absolutely positioned, so it doesn't take a
  // flex-basis slot.
  const showSideInFlow = isDesktop && previewMode === "side"

  // Wrapper className/style for the single PreviewPane mount. The
  // wrapper element stays at the SAME React tree position across all
  // modes — only its className/style change. That's load-bearing
  // because each remount loses heartbeat state, signed-token age,
  // scroll position, and mid-typing debounce timers.
  // Phone: closed = hidden (iframe not visible); open = fixed inset-0
  // fullscreen overlay (z-50).
  const previewWrapperClass = cn(
    "flex flex-col",
    isDesktop && previewMode === "hidden" && "hidden",
    showSideInFlow && "min-w-0 border-l bg-background md:sticky md:top-0 md:self-start md:h-[calc(100dvh-6rem)]",
    isDesktop && previewMode === "fullscreen" &&
      "fixed inset-0 bg-background z-40",
    !isDesktop && !isPreviewOpen && "hidden",
    !isDesktop && isPreviewOpen && "fixed inset-0 z-50 bg-background",
  )
  const previewWrapperStyle: React.CSSProperties | undefined = showSideInFlow
    ? {
        flex: `0 0 ${splitPct}%`,
        transition: isDragging ? "none" : "flex-basis 80ms ease-out",
      }
    : undefined

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlAny = form.control as unknown as import("react-hook-form").Control<any>

  const previewPane = (
    <PreviewPane
      control={controlAny}
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

  // Danger zone section — reused in both side-mode column and hidden-mode grid.
  const dangerZone = (
    <section className="rounded-md border border-destructive/50 bg-destructive/5 p-4">
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
  )

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit, onInvalid)}
        className="flex flex-col w-full"
      >
        {/*
          Sticky TopBar — desktop side-preview mode only. Contains the
          card-less Title + Slug fields and the bare PublishControls so
          the primary actions are always reachable without scrolling.
          `hidden md:flex` ensures it never renders on phone.
          TopBar lives inside <form> so the Save button remains type="submit".
        */}
        {showSideInFlow && (
          <header className="hidden md:flex shrink-0 items-end gap-4 border-b bg-background px-4 py-3">
            <PageMetaInline control={controlAny} />
            {form.watch("status") === "published" && form.watch("slug") && (
              <>
                <Button variant="ghost" size="icon" type="button" asChild title="View live">
                  <a href={`${tenantOrigin}/${form.watch("slug")}`} target="_blank" rel="noopener noreferrer" aria-label="View live page">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
                <Button variant="ghost" size="icon" type="button" title="Copy URL"
                  onClick={() => {
                    navigator.clipboard.writeText(`${tenantOrigin}/${form.watch("slug")}`)
                    toast.success("URL copied")
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </>
            )}
            <PublishControls control={controlAny} pending={pending} isDirty={isDirty} errorCount={errorCount} variant="bare" />
          </header>
        )}
        {/*
          Inner columns row. `formContainerRef` is on THIS div (not the
          outer flex-col) so SplitDivider's getBoundingClientRect().width
          reads the correct editor-area width and not the full viewport.
        */}
        <div
          ref={formContainerRef}
          className={cn(
            "relative flex w-full min-h-0",
            showSideInFlow && "md:h-[calc(100dvh-6rem)]",
            !showSideInFlow && "flex-1",
          )}
        >
          {/*
            Snap guide lines. Render during drag only in side mode so the
            operator can see where the four snap points (30/40/50/60%) land.
            Positioned as absolute children against the container row (which
            has `position: relative`). The guide lines are at X = pct% from
            the RIGHT edge (preview occupies the right side), so left =
            (100 - p)%.
          */}
          {showSideInFlow && isDragging && [30, 40, 50, 60].map((p) => (
            <span
              key={p}
              className="absolute top-0 bottom-0 w-px bg-primary/40 pointer-events-none z-[9]"
              style={{ left: `${100 - p}%` }}
              aria-hidden
            />
          ))}
          {/*
            Editor column. `min-w-0` is mandatory to break the flex
            min-content chain — without it, intrinsic widths of nested
            inputs/cards propagate up through <main>/<SidebarInset> and
            cause horizontal body scroll at narrow desktop widths. The
            previous `min-w-[480px]` floor was theoretical (splitter range
            [20,60] already prevents silly-narrow editor); it caused real
            horizontal overflow on live.
          */}
          <div className={cn(
            "flex-1 min-w-0",
            showSideInFlow && "min-h-0 overflow-y-auto",
          )}>
            {showSideInFlow ? (
              /*
                Side mode: editor column shows ONLY the Blocks card.
                SEO + Danger Zone are rendered BELOW the split-view row
                (outside formContainerRef) so the user can scroll to them
                while the preview remains sticky at the top-right.
                No Page card (Title/Slug in TopBar), no Publish card
                (PublishControls in TopBar).
              */
              <div className="flex flex-col gap-4 p-4">
                <Card>
                  <CardHeader><CardTitle>Blocks</CardTitle></CardHeader>
                  <CardContent><BlockEditor tenantId={tenantId} isPhone={!isDesktop} pageId={initial?.id ?? `draft-${draftSessionId}`}/></CardContent>
                </Card>
              </div>
            ) : (
              /*
                Hidden mode (and fullscreen): existing 3-col @container grid.
                Page card + Blocks (col-span-2), Publish + SEO column,
                Danger Zone below.
                Phone-only combined Page+Publish card prepended above the grid.
              */
              <div className="@container/editor p-4 md:pb-4 pb-[calc(var(--mini-strip-h,56px)+env(safe-area-inset-bottom))]">
                {/*
                  Phone-only combined Page+Publish card. Rendered only on <md
                  so the operator sees title/slug/publish controls at the top
                  without having to scroll past the blocks list. The
                  corresponding grid cards are hidden on phone via `hidden md:block`
                  below — only ONE set of Controllers is active per breakpoint.
                */}
                {!isDesktop && (
                  <div className="md:hidden mb-4">
                    <Card>
                      <CardHeader><CardTitle>Page</CardTitle></CardHeader>
                      <CardContent className="space-y-4">
                        <FormField
                          control={form.control}
                          name="title"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Title*</FormLabel>
                              <FormControl><Input {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="slug"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Slug*</FormLabel>
                              <FormControl><Input {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <PublishControls
                          control={controlAny}
                          pending={pending}
                          isDirty={isDirty}
                          errorCount={errorCount}
                          variant="card"
                        />
                      </CardContent>
                    </Card>
                  </div>
                )}
                <div className="grid grid-cols-1 @[800px]/editor:grid-cols-3 gap-4">
                  <div className="@[800px]/editor:col-span-2 space-y-4">
                    {/* Page card: hidden on phone (combined card above handles it). */}
                    <div className="hidden md:block">
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
                    </div>
                    <Card>
                      <CardHeader><CardTitle>Blocks</CardTitle></CardHeader>
                      <CardContent><BlockEditor tenantId={tenantId} isPhone={!isDesktop} pageId={initial?.id ?? `draft-${draftSessionId}`}/></CardContent>
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
                    {/* Publish card: hidden on phone (combined card above handles it). */}
                    <div className="hidden md:block">
                      <Card>
                        <CardHeader><CardTitle>Publish</CardTitle></CardHeader>
                        <CardContent className="space-y-3">
                          <PublishControls control={controlAny} pending={pending} isDirty={isDirty} errorCount={errorCount} variant="card" />
                        </CardContent>
                      </Card>
                    </div>
                    <Card>
                      <CardHeader><CardTitle>SEO</CardTitle></CardHeader>
                      <CardContent className="space-y-3">
                        {seoFields.map((f, i) => <FieldRenderer key={i} field={f} namePrefix="seo"/>)}
                      </CardContent>
                    </Card>
                  </div>
                  {/* Danger Zone spans full width below the grid. mt-8 matches
                      the original visual separation since grid's gap-4 only
                      applies between same-level grid children. */}
                  <div className="@[800px]/editor:col-span-3 mt-8">
                    {dangerZone}
                  </div>
                </div>
              </div>
            )}
          </div>
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
            {/*
              Phone preview overlay: "Done" button to return to edit mode.
              Only shown on phone (<md) when preview is open. Sits above the
              PreviewPane (z-10 relative to the z-50 overlay).
            */}
            {!isDesktop && isPreviewOpen && (
              <div className="md:hidden flex items-center gap-2 shrink-0 border-b bg-background px-3 py-2">
                <button
                  type="button"
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => setIsPreviewOpen(false)}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-sm font-medium hover:bg-accent"
                  aria-label="Back to edit"
                >
                  <X className="h-4 w-4" aria-hidden />
                  Done
                </button>
              </div>
            )}
            {/*
              Inner pane container. Always rendered (so PreviewPane's
              position in the React tree is stable across breakpoint
              flips and never remounts) — its className just no-ops on
              non-phone modes. On phone, `flex-1 min-h-0` fills the
              fixed overlay. On desktop the wrapper above sizes the pane
              directly so this container effectively `display: contents`.
            */}
            <div className={cn(
              "flex flex-col",
              (!isDesktop && isPreviewOpen) ? "flex-1 min-h-0 overflow-hidden" : "h-full",
            )}>
              {previewPane}
            </div>
          </div>
        </div>
        {/*
          Side-mode only: SEO + Danger Zone rendered below the split-view row
          so the user can scroll to them while the preview stays sticky.
          Hidden mode keeps them inside the 3-col grid above.
        */}
        {showSideInFlow && (
          <section className="px-4 py-6 space-y-4 max-w-3xl">
            <Card>
              <CardHeader><CardTitle>SEO</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {seoFields.map((f, i) => <FieldRenderer key={i} field={f} namePrefix="seo"/>)}
              </CardContent>
            </Card>
            {dangerZone}
          </section>
        )}
        {/*
          Phone-only Save FAB. Sits above the mini-strip. Visible only when
          there is unsaved work (dirty), validation errors, or a save is
          in-flight. Hidden when preview overlay is open.
        */}
        {!isDesktop && !isPreviewOpen && (isDirty || errorCount > 0 || pending) && (
          <button
            type="button"
            disabled={pending}
            onPointerDown={(e) => {
              const tag = document.activeElement?.tagName
              if (tag === "INPUT" || tag === "TEXTAREA") e.preventDefault()
            }}
            onClick={triggerSave}
            className="phone-fab relative md:hidden fixed z-30 right-4 rounded-full bg-primary text-primary-foreground shadow-lg h-14 w-14 flex items-center justify-center disabled:opacity-60"
            style={{ bottom: `calc(var(--mini-strip-h, 56px) + env(safe-area-inset-bottom) + 0.75rem)` }}
            aria-label="Save page"
          >
            {pending ? <Loader2 className="h-6 w-6 animate-spin" aria-hidden /> : <Save className="h-6 w-6" aria-hidden />}
            {errorCount > 0 && (
              <span className="absolute -top-1 -right-1 rounded-full bg-destructive text-destructive-foreground text-[10px] h-5 w-5 flex items-center justify-center">
                {errorCount}
              </span>
            )}
          </button>
        )}
      </form>
      <SaveStatusBar
        status={saveStatus}
        dirtyCount={dirtyCount}
        errorCount={errorCount}
        lastSavedAt={lastSavedAt}
        onSave={triggerSave}
        onRetry={retry}
        onJumpToError={jumpToError}
        previewMode={previewMode}
        setPreviewMode={setPreviewMode}
      />
      {!isDesktop && !isPreviewOpen && (
        <PhonePreviewStrip
          status={previewStatus}
          errorMessage={previewErrorMessage}
          pageTitle={form.watch("title")}
          onOpen={() => setIsPreviewOpen(true)}
        />
      )}
      <UnsavedChangesDialog
        open={guard.pending !== null}
        onCancel={guard.cancel}
        onConfirm={guard.confirm}
      />
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
