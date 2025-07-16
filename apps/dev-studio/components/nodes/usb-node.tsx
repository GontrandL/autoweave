'use client'

import { Handle, Position, NodeProps } from 'reactflow'
import { Card, CardContent, CardHeader, CardTitle } from '@autoweave/ui'
import { Usb } from 'lucide-react'

export function USBNode({ data, isConnectable }: NodeProps) {
  return (
    <Card className="w-48">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center">
          <Usb className="mr-2 h-4 w-4" />
          {data.label}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-xs text-muted-foreground">
          Hardware Interface
        </div>
      </CardContent>
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={isConnectable}
      />
    </Card>
  )
}