import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/AppSidebar"
import { SiteHeader } from "@/components/layout/SiteHeader"
import { requireAuth } from "@/lib/authGate"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, ctx } = await requireAuth()
  return (
    <SidebarProvider>
      <AppSidebar mode={ctx.mode} role={user.role} />
      <SidebarInset>
        <SiteHeader user={user} />
        {/* U2 / methodology §1 16-px content-inset floor — `max-md:p-4`
            keeps Cards from touching the viewport edge on phones (Cards
            previously sat with only 8 px inset under `max-md:p-2`). */}
        <main className="flex-1 max-md:p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
