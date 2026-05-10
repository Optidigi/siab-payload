import "@/styles/globals.css"
import type { Metadata } from "next"
import { Inter, JetBrains_Mono } from "next/font/google"
import { ThemeProvider } from "@/components/layout/ThemeProvider"
import { Toaster } from "@/components/ui/sonner"

const sans = Inter({ subsets: ["latin"], variable: "--font-sans" })
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" })

// WCAG 2.4.2 (Page Titled, Level A) — every route gets a non-empty <title>.
// Pages without a `metadata.title` export inherit `default`. Pages with one
// get `template` applied — e.g. `title: "Sites"` renders "Sites · SiteInABox".
// Dynamic routes use `generateMetadata` to inject the tenant / page name (see
// /sites/[slug]/page.tsx and /sites/[slug]/pages/[id]/page.tsx).
export const metadata: Metadata = {
  title: { default: "SiteInABox", template: "%s · SiteInABox" }
}

export default function FrontendLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${mono.variable}`}>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <Toaster
            richColors
            position="bottom-center"
            duration={6000}
            offset={"calc(max(var(--mini-strip-h, 0px) + env(safe-area-inset-bottom) + 12px, 80px))"}
          />
        </ThemeProvider>
      </body>
    </html>
  )
}
