import type { Metadata } from "next"
import "./globals.css"
import AuthProvider from "@/components/Providers/AuthProvider"

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
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
