"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Globe, Users, Inbox, ListChecks, Settings, FileText, Image as ImageIcon } from "lucide-react"
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem
} from "@/components/ui/sidebar"

type Mode = "super-admin" | "tenant"
type Role = "super-admin" | "owner" | "editor" | "viewer"

export function AppSidebar({ mode, role }: { mode: Mode; role: Role }) {
  const pathname = usePathname() ?? "/"
  const slugMatch = pathname.match(/^\/sites\/([^/]+)/)
  const tenantSlug = slugMatch?.[1]
  const inTenantView = mode === "super-admin" && !!tenantSlug
  const base = inTenantView ? `/sites/${tenantSlug}` : ""

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link href="/" className="flex items-center gap-2 px-2 py-1.5 font-semibold">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs">S</span>
          SiteInABox
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Overview</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem><SidebarMenuButton asChild><Link href="/"><LayoutDashboard /> Dashboard</Link></SidebarMenuButton></SidebarMenuItem>
              {mode === "super-admin" && !inTenantView && (
                <>
                  <SidebarMenuItem><SidebarMenuButton asChild><Link href="/sites"><Globe /> Sites</Link></SidebarMenuButton></SidebarMenuItem>
                  <SidebarMenuItem><SidebarMenuButton asChild><Link href="/users"><Users /> Users</Link></SidebarMenuButton></SidebarMenuItem>
                </>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Content</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem><SidebarMenuButton asChild><Link href={`${base}/pages`}><FileText /> Pages</Link></SidebarMenuButton></SidebarMenuItem>
              <SidebarMenuItem><SidebarMenuButton asChild><Link href={`${base}/media`}><ImageIcon /> Media</Link></SidebarMenuButton></SidebarMenuItem>
              <SidebarMenuItem><SidebarMenuButton asChild><Link href={`${base}/forms`}><Inbox /> Forms</Link></SidebarMenuButton></SidebarMenuItem>
              <SidebarMenuItem><SidebarMenuButton asChild><Link href={`${base}/settings`}><Settings /> Settings</Link></SidebarMenuButton></SidebarMenuItem>
              {(mode === "super-admin" || role === "owner") && (
                <SidebarMenuItem><SidebarMenuButton asChild><Link href={`${base}/users`}><Users /> Team</Link></SidebarMenuButton></SidebarMenuItem>
              )}
              {inTenantView && (
                <SidebarMenuItem><SidebarMenuButton asChild><Link href={`${base}/onboarding`}><ListChecks /> Onboarding</Link></SidebarMenuButton></SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter />
    </Sidebar>
  )
}
