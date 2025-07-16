'use client'

import { Suspense } from 'react'
import dynamic from 'next/dynamic'

// Lazy load heavy components
const SystemMetrics = dynamic(() => import('./system-metrics').then(mod => ({ default: mod.SystemMetrics })), {
  loading: () => (
    <div className="flex items-center justify-center h-64">
      <div className="animate-pulse bg-muted h-32 w-full rounded"></div>
    </div>
  ),
  ssr: false,
})

const ServiceStatus = dynamic(() => import('./service-status').then(mod => ({ default: mod.ServiceStatus })), {
  loading: () => <div className="animate-pulse bg-muted h-32 rounded"></div>,
})

// Mobile-first responsive design
export function ResponsiveLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      {/* Mobile navigation */}
      <div className="lg:hidden">
        <MobileNav />
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:block lg:fixed lg:inset-y-0 lg:w-64">
        <DesktopSidebar />
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}

function MobileNav() {
  return (
    <div className="bg-background border-b p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">AutoWeave</h1>
        <button className="p-2">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>
    </div>
  )
}

function DesktopSidebar() {
  return (
    <div className="bg-muted/40 h-full p-4">
      <nav className="space-y-2">
        <a href="/health" className="block px-3 py-2 rounded-md text-sm font-medium hover:bg-accent">
          Health
        </a>
        <a href="/plugins" className="block px-3 py-2 rounded-md text-sm font-medium hover:bg-accent">
          Plugins
        </a>
        <a href="/logs" className="block px-3 py-2 rounded-md text-sm font-medium hover:bg-accent">
          Logs
        </a>
        <a href="/costs" className="block px-3 py-2 rounded-md text-sm font-medium hover:bg-accent">
          Costs
        </a>
      </nav>
    </div>
  )
}

export { SystemMetrics, ServiceStatus }