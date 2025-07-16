import { Suspense } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@autoweave/ui'
import { SystemMetrics } from '@/components/system-metrics'
import { ServiceStatus } from '@/components/service-status'
import { AlertsPanel } from '@/components/alerts-panel'
import { Activity, HardDrive, MemoryStick, Usb } from 'lucide-react'

export default function HealthPage() {
  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">System Health</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">USB Devices</CardTitle>
            <Usb className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground">+2 from last hour</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Plugins
            </CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">8</div>
            <p className="text-xs text-muted-foreground">All running</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Queue Jobs</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">45</div>
            <p className="text-xs text-muted-foreground">Processing</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
            <MemoryStick className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2.4GB</div>
            <p className="text-xs text-muted-foreground">68% of available</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>System Metrics</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <Suspense fallback={<div className="h-64 animate-pulse bg-muted rounded" />}>
              <SystemMetrics />
            </Suspense>
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Service Status</CardTitle>
            <CardDescription>Real-time service health</CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<div className="h-64 animate-pulse bg-muted rounded" />}>
              <ServiceStatus />
            </Suspense>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-1">
        <Card>
          <CardHeader>
            <CardTitle>Active Alerts</CardTitle>
            <CardDescription>Critical system notifications</CardDescription>
          </CardHeader>
          <CardContent>
            <AlertsPanel />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}