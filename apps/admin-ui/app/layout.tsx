import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'AutoWeave Admin Dashboard',
  description: 'Administrative interface for AutoWeave system management',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen bg-background">
          <nav className="border-b">
            <div className="flex h-16 items-center px-4">
              <div className="flex items-center space-x-4">
                <h1 className="text-xl font-bold">AutoWeave Admin</h1>
              </div>
              <div className="ml-auto flex items-center space-x-4">
                <nav className="flex items-center space-x-4">
                  <a href="/health" className="text-sm font-medium transition-colors hover:text-primary">
                    Health
                  </a>
                  <a href="/plugins" className="text-sm font-medium transition-colors hover:text-primary">
                    Plugins
                  </a>
                  <a href="/logs" className="text-sm font-medium transition-colors hover:text-primary">
                    Logs
                  </a>
                  <a href="/costs" className="text-sm font-medium transition-colors hover:text-primary">
                    Costs
                  </a>
                </nav>
              </div>
            </div>
          </nav>
          <main className="flex-1">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}