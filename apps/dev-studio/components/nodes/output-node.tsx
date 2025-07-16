'use client'

import { Handle, Position, NodeProps } from 'reactflow'
import { Card, CardContent, CardHeader, CardTitle } from '@autoweave/ui'
import { FileOutput } from 'lucide-react'

export function OutputNode({ data, isConnectable }: NodeProps) {
  return (
    <Card className="w-48">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center">
          <FileOutput className="mr-2 h-4 w-4" />
          {data.label}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-xs text-muted-foreground">
          Output Results
        </div>
      </CardContent>
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={isConnectable}
      />
    </Card>
  )
}