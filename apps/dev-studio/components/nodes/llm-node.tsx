'use client'

import { Handle, Position, NodeProps } from 'reactflow'
import { Card, CardContent, CardHeader, CardTitle } from '@autoweave/ui'
import { Bot } from 'lucide-react'

export function LLMNode({ data, isConnectable }: NodeProps) {
  return (
    <Card className="w-48">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center">
          <Bot className="mr-2 h-4 w-4" />
          {data.label}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-xs text-muted-foreground">
          AI Processing Node
        </div>
      </CardContent>
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={isConnectable}
      />
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={isConnectable}
      />
    </Card>
  )
}