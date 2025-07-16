'use client'

import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@autoweave/ui'
import { Settings, Trash2, Play, Square } from 'lucide-react'

interface Plugin {
  id: string
  name: string
  version: string
  status: 'running' | 'stopped' | 'error'
  description: string
  memoryUsage: number
  author: string
  category: string
}

const plugins: Plugin[] = [
  {
    id: '1',
    name: 'USB Scanner Plugin',
    version: '2.0.1',
    status: 'running',
    description: 'Enables document scanning via USB-connected scanners',
    memoryUsage: 45,
    author: 'AutoWeave Team',
    category: 'Hardware',
  },
  {
    id: '2',
    name: 'Document Processor',
    version: '1.5.3',
    status: 'running',
    description: 'Advanced document processing with OCR capabilities',
    memoryUsage: 128,
    author: 'AutoWeave Team',
    category: 'AI',
  },
  {
    id: '3',
    name: 'Voice Interface',
    version: '1.2.0',
    status: 'stopped',
    description: 'Voice command and speech-to-text integration',
    memoryUsage: 0,
    author: 'Community',
    category: 'Interface',
  },
  {
    id: '4',
    name: 'Data Analytics',
    version: '0.9.2',
    status: 'error',
    description: 'Real-time data analysis and visualization',
    memoryUsage: 89,
    author: 'Third Party',
    category: 'Analytics',
  },
]

export function PluginList() {
  const getStatusBadge = (status: Plugin['status']) => {
    switch (status) {
      case 'running':
        return <Badge variant="default">Running</Badge>
      case 'stopped':
        return <Badge variant="secondary">Stopped</Badge>
      case 'error':
        return <Badge variant="destructive">Error</Badge>
    }
  }

  const getStatusIcon = (status: Plugin['status']) => {
    switch (status) {
      case 'running':
        return <Square className="h-4 w-4" />
      case 'stopped':
        return <Play className="h-4 w-4" />
      case 'error':
        return <Play className="h-4 w-4" />
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {plugins.map((plugin) => (
        <Card key={plugin.id} className="flex flex-col">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">{plugin.name}</CardTitle>
                <CardDescription>v{plugin.version} by {plugin.author}</CardDescription>
              </div>
              {getStatusBadge(plugin.status)}
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            <p className="text-sm text-muted-foreground mb-4">
              {plugin.description}
            </p>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Memory: {plugin.memoryUsage} MB</span>
              <Badge variant="outline">{plugin.category}</Badge>
            </div>
            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center space-x-2">
                <Button size="sm" variant="outline">
                  {getStatusIcon(plugin.status)}
                </Button>
                <Button size="sm" variant="outline">
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
              <Button size="sm" variant="outline">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}