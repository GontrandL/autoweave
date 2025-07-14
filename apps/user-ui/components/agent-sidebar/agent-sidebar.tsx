'use client'

import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from '@autoweave/ui'
import { Plus, Bot, FileText, BarChart3 } from 'lucide-react'

interface Agent {
  id: string
  name: string
  status: 'online' | 'offline' | 'busy'
  description: string
  capabilities: string[]
  icon: React.ComponentType<any>
}

const agents: Agent[] = [
  {
    id: '1',
    name: 'Document Scanner',
    status: 'online',
    description: 'Scans and processes documents via USB scanner',
    capabilities: ['USB', 'OCR', 'PDF'],
    icon: FileText,
  },
  {
    id: '2',
    name: 'Code Assistant',
    status: 'online',
    description: 'Helps with programming tasks and code review',
    capabilities: ['Coding', 'Debug', 'Review'],
    icon: Bot,
  },
  {
    id: '3',
    name: 'Data Analyst',
    status: 'busy',
    description: 'Analyzes data and generates insights',
    capabilities: ['Analytics', 'Charts', 'SQL'],
    icon: BarChart3,
  },
]

export function AgentSidebar() {
  const getStatusBadge = (status: Agent['status']) => {
    switch (status) {
      case 'online':
        return <Badge variant="default">Online</Badge>
      case 'busy':
        return <Badge variant="secondary">Busy</Badge>
      case 'offline':
        return <Badge variant="outline">Offline</Badge>
    }
  }

  return (
    <div className="w-80 border-r bg-muted/40 p-4" data-testid="agent-sidebar">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Available Agents</h2>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" />
          New
        </Button>
      </div>

      <div className="space-y-3">
        {agents.map((agent) => (
          <Card
            key={agent.id}
            className="cursor-pointer hover:bg-accent/50 transition-colors"
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <agent.icon className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-sm">{agent.name}</CardTitle>
                </div>
                {getStatusBadge(agent.status)}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs text-muted-foreground mb-2">
                {agent.description}
              </p>
              <div className="flex flex-wrap gap-1">
                {agent.capabilities.map((cap) => (
                  <Badge key={cap} variant="outline" className="text-xs">
                    {cap}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}