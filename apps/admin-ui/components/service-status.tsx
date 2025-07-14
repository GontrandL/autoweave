'use client'

import { Badge } from '@autoweave/ui'
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react'

interface Service {
  name: string
  status: 'running' | 'stopped' | 'error'
  uptime: string
  lastCheck: string
}

const services: Service[] = [
  { name: 'AutoWeave Core', status: 'running', uptime: '99.9%', lastCheck: '2 min ago' },
  { name: 'USB Daemon', status: 'running', uptime: '98.5%', lastCheck: '1 min ago' },
  { name: 'Memory System', status: 'running', uptime: '99.2%', lastCheck: '3 min ago' },
  { name: 'Plugin Manager', status: 'running', uptime: '97.8%', lastCheck: '1 min ago' },
  { name: 'GraphQL Gateway', status: 'running', uptime: '99.5%', lastCheck: '2 min ago' },
  { name: 'WebSocket Server', status: 'error', uptime: '85.2%', lastCheck: '5 min ago' },
]

export function ServiceStatus() {
  const getStatusIcon = (status: Service['status']) => {
    switch (status) {
      case 'running':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'stopped':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
    }
  }

  const getStatusBadge = (status: Service['status']) => {
    switch (status) {
      case 'running':
        return <Badge variant="default">Running</Badge>
      case 'stopped':
        return <Badge variant="destructive">Stopped</Badge>
      case 'error':
        return <Badge variant="secondary">Error</Badge>
    }
  }

  return (
    <div className="space-y-4">
      {services.map((service) => (
        <div key={service.name} className="flex items-center justify-between p-3 border rounded-lg">
          <div className="flex items-center space-x-3">
            {getStatusIcon(service.status)}
            <div>
              <p className="font-medium">{service.name}</p>
              <p className="text-sm text-muted-foreground">
                Uptime: {service.uptime}
              </p>
            </div>
          </div>
          <div className="text-right">
            {getStatusBadge(service.status)}
            <p className="text-xs text-muted-foreground mt-1">
              {service.lastCheck}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}