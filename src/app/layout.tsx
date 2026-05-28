import type { Metadata } from "next"
import "./globals.css"
import AuthProvider from "@/components/Providers/AuthProvider"
import { ThemeProvider } from "@/components/Providers/ThemeProvider"

export const metadata: Metadata = {
  title: "YNAB Clone",
  description: "Give every dollar a job.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 dark:text-slate-200 transition-colors">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
