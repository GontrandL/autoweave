'use client'

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@autoweave/ui'
import { Bot, Usb, FileOutput, Database, Workflow } from 'lucide-react'

interface NodeToolboxProps {
  onAddNode: (type: string) => void
}

const nodeTypes = [
  {
    type: 'llm',
    icon: Bot,
    label: 'LLM Node',
    description: 'AI processing node',
  },
  {
    type: 'usb',
    icon: Usb,
    label: 'USB Node',
    description: 'Hardware interface',
  },
  {
    type: 'output',
    icon: FileOutput,
    label: 'Output Node',
    description: 'Data output',
  },
  {
    type: 'database',
    icon: Database,
    label: 'Database Node',
    description: 'Data storage',
  },
  {
    type: 'workflow',
    icon: Workflow,
    label: 'Workflow Node',
    description: 'Process control',
  },
]

export function NodeToolbox({ onAddNode }: NodeToolboxProps) {
  return (
    <div className="w-64 border-r bg-muted/40 p-4 overflow-y-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Node Toolbox</CardTitle>
          <CardDescription>
            Drag and drop nodes to build your workflow
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {nodeTypes.map((nodeType) => (
            <Button
              key={nodeType.type}
              variant="outline"
              className="w-full justify-start"
              onClick={() => onAddNode(nodeType.type)}
              data-testid={`${nodeType.type}-node-button`}
            >
              <nodeType.icon className="mr-2 h-4 w-4" />
              <div className="text-left">
                <div className="font-medium">{nodeType.label}</div>
                <div className="text-xs text-muted-foreground">
                  {nodeType.description}
                </div>
              </div>
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}