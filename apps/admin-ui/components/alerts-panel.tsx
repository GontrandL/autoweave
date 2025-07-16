'use client'

import { Badge } from '@autoweave/ui'
import { AlertTriangle, Info, AlertCircle } from 'lucide-react'

interface Alert {
  id: string
  level: 'info' | 'warning' | 'error'
  title: string
  message: string
  timestamp: string
}

const alerts: Alert[] = [
  {
    id: '1',
    level: 'warning',
    title: 'High Memory Usage',
    message: 'System memory usage is at 85%. Consider scaling resources.',
    timestamp: '2 minutes ago',
  },
  {
    id: '2',
    level: 'error',
    title: 'WebSocket Connection Failed',
    message: 'Unable to establish WebSocket connection for real-time updates.',
    timestamp: '5 minutes ago',
  },
  {
    id: '3',
    level: 'info',
    title: 'Plugin Update Available',
    message: 'USB Scanner plugin v2.1.0 is available for update.',
    timestamp: '1 hour ago',
  },
]

export function AlertsPanel() {
  const getAlertIcon = (level: Alert['level']) => {
    switch (level) {
      case 'info':
        return <Info className="h-4 w-4 text-blue-500" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />
    }
  }

  const getAlertBadge = (level: Alert['level']) => {
    switch (level) {
      case 'info':
        return <Badge variant="secondary">Info</Badge>
      case 'warning':
        return <Badge variant="secondary">Warning</Badge>
      case 'error':
        return <Badge variant="destructive">Error</Badge>
    }
  }

  return (
    <div className="space-y-4">
      {alerts.map((alert) => (
        <div key={alert.id} className="flex items-start space-x-3 p-4 border rounded-lg">
          {getAlertIcon(alert.level)}
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">{alert.title}</h4>
              {getAlertBadge(alert.level)}
            </div>
            <p className="text-sm text-muted-foreground mt-1">{alert.message}</p>
            <p className="text-xs text-muted-foreground mt-2">{alert.timestamp}</p>
          </div>
        </div>
      ))}
    </div>
  )
}