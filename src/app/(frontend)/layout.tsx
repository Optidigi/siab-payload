import "@/styles/globals.css"
import { Inter, JetBrains_Mono } from "next/font/google"
import { ThemeProvider } from "@/components/layout/ThemeProvider"
import { Toaster } from "@/components/ui/sonner"

const sans = Inter({ subsets: ["latin"], variable: "--font-sans" })
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" })

export default function FrontendLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${mono.variable}`}>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <Toaster
            richColors
            position="bottom-center"
            offset={"calc(max(var(--mini-strip-h, 0px) + env(safe-area-inset-bottom) + 12px, 80px))"}
          />
        </ThemeProvider>
      </body>
    </html>
  )
}
