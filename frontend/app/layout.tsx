import type React from "react"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/lib/theme-provider"
import { AuthProvider } from "@/lib/auth-context"
import { Toaster } from "@/components/ui/toaster"
import { ReactQueryProvider } from "@/components/providers/react-query-provider"
import { SWRProvider } from "@/components/providers/swr-provider"
import { ClientInit } from "@/components/providers/client-init"

const inter = Inter({ subsets: ["latin"] })

export const metadata = {
  title: "Real Estate ERP - Property Management System",
  description: "Comprehensive enterprise resource planning for real estate management",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script src="/clear-cache.js" defer></script>
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <SWRProvider>
          <ThemeProvider defaultTheme="light">
            <ReactQueryProvider>
              <AuthProvider>
                <ClientInit />
                {children}
                <Toaster />
              </AuthProvider>
            </ReactQueryProvider>
          </ThemeProvider>
        </SWRProvider>
      </body>
    </html>
  )
}
