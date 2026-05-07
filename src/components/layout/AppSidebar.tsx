"use client"
import { useEffect, useRef } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Globe, Users, Inbox, ListChecks, Settings, FileText, Image as ImageIcon } from "lucide-react"
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  useSidebar
} from "@/components/ui/sidebar"

type Mode = "super-admin" | "tenant"
type Role = "super-admin" | "owner" | "editor" | "viewer"

export function AppSidebar({ mode, role }: { mode: Mode; role: Role }) {
  const pathname = usePathname() ?? "/"
  const { isMobile, setOpenMobile } = useSidebar()
  const lastPathRef = useRef(pathname)
  useEffect(() => {
    if (isMobile && lastPathRef.current !== pathname) {
      setOpenMobile(false)
    }
    lastPathRef.current = pathname
  }, [pathname, isMobile, setOpenMobile])
  const slugMatch = pathname.match(/^\/sites\/([^/]+)/)
  const tenantSlug = slugMatch?.[1]
  const inTenantView = mode === "super-admin" && !!tenantSlug
  const base = inTenantView ? `/sites/${tenantSlug}` : ""

  // Selected-state matcher. Special-case "/" (Dashboard) to require an
  // exact match — otherwise startsWith("/") would match every route.
  // For all other links, an exact match OR a deeper sub-path counts as
  // "active" (e.g. /sites/foo/pages keeps "Sites" highlighted in Overview
  // because the user is conceptually still in that section).
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/")

  // Content group (Pages/Media/Forms/Settings — plus Team/Onboarding when
  // their inner gates pass) only makes sense in two contexts:
  //   1. tenant editors (mode === "tenant") — they author for their own tenant
  //   2. super-admin viewing a specific tenant (inTenantView === true) —
  //      links resolve to /sites/<slug>/* and edit that tenant's content
  // For super-admin AT TOP LEVEL (no tenant picked), every Content link
  // would resolve to a top-level route that just redirects to /sites — dead
  // ends. Hide the group entirely; the user picks a site from the Overview
  // group's Sites link instead.
  const showContent = mode === "tenant" || inTenantView

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link href="/" className="flex items-center gap-2 px-2 py-1.5 font-semibold group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs">S</span>
          <span className="group-data-[collapsible=icon]:hidden">SiteInABox</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Overview</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem><SidebarMenuButton asChild isActive={isActive("/")}><Link href="/"><LayoutDashboard /> Dashboard</Link></SidebarMenuButton></SidebarMenuItem>
              {mode === "super-admin" && !inTenantView && (
                <>
                  <SidebarMenuItem><SidebarMenuButton asChild isActive={isActive("/sites")}><Link href="/sites"><Globe /> Sites</Link></SidebarMenuButton></SidebarMenuItem>
                  <SidebarMenuItem><SidebarMenuButton asChild isActive={isActive("/users")}><Link href="/users"><Users /> Users</Link></SidebarMenuButton></SidebarMenuItem>
                </>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {showContent && (
          <SidebarGroup>
            <SidebarGroupLabel>Content</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem><SidebarMenuButton asChild isActive={isActive(`${base}/pages`)}><Link href={`${base}/pages`}><FileText /> Pages</Link></SidebarMenuButton></SidebarMenuItem>
                <SidebarMenuItem><SidebarMenuButton asChild isActive={isActive(`${base}/media`)}><Link href={`${base}/media`}><ImageIcon /> Media</Link></SidebarMenuButton></SidebarMenuItem>
                <SidebarMenuItem><SidebarMenuButton asChild isActive={isActive(`${base}/forms`)}><Link href={`${base}/forms`}><Inbox /> Forms</Link></SidebarMenuButton></SidebarMenuItem>
                <SidebarMenuItem><SidebarMenuButton asChild isActive={isActive(`${base}/settings`)}><Link href={`${base}/settings`}><Settings /> Settings</Link></SidebarMenuButton></SidebarMenuItem>
                {(inTenantView || role === "owner") && (
                  <SidebarMenuItem><SidebarMenuButton asChild isActive={isActive(`${base}/users`)}><Link href={`${base}/users`}><Users /> Team</Link></SidebarMenuButton></SidebarMenuItem>
                )}
                {inTenantView && (
                  <SidebarMenuItem><SidebarMenuButton asChild isActive={isActive(`${base}/onboarding`)}><Link href={`${base}/onboarding`}><ListChecks /> Onboarding</Link></SidebarMenuButton></SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter />
    </Sidebar>
  )
}
