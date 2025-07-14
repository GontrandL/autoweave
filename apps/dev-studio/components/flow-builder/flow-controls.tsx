'use client'

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@autoweave/ui'
import { Play, Save, Download, Upload } from 'lucide-react'
import { Node } from 'reactflow'

interface FlowControlsProps {
  selectedNode: Node | null
}

export function FlowControls({ selectedNode }: FlowControlsProps) {
  return (
    <div className="absolute top-4 right-4 space-y-4">
      <Card className="w-64">
        <CardHeader>
          <CardTitle className="text-lg">Flow Controls</CardTitle>
          <CardDescription>
            Manage your workflow
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button className="w-full">
            <Play className="mr-2 h-4 w-4" />
            Run Flow
          </Button>
          <Button variant="outline" className="w-full">
            <Save className="mr-2 h-4 w-4" />
            Save Flow
          </Button>
          <div className="flex space-x-2">
            <Button variant="outline" className="flex-1">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button variant="outline" className="flex-1">
              <Upload className="mr-2 h-4 w-4" />
              Import
            </Button>
          </div>
        </CardContent>
      </Card>

      {selectedNode && (
        <Card className="w-64">
          <CardHeader>
            <CardTitle className="text-lg">Node Properties</CardTitle>
            <CardDescription>
              Configure selected node
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <label className="text-sm font-medium">Node ID</label>
                <p className="text-sm text-muted-foreground">{selectedNode.id}</p>
              </div>
              <div>
                <label className="text-sm font-medium">Node Type</label>
                <p className="text-sm text-muted-foreground">{selectedNode.type}</p>
              </div>
              <div>
                <label className="text-sm font-medium">Label</label>
                <p className="text-sm text-muted-foreground">{selectedNode.data.label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}