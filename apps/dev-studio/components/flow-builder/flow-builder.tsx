'use client'

import { useCallback, useState } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
} from 'reactflow'

import { NodeToolbox } from './node-toolbox'
import { FlowControls } from './flow-controls'
import { LLMNode } from '../nodes/llm-node'
import { USBNode } from '../nodes/usb-node'
import { OutputNode } from '../nodes/output-node'

const nodeTypes = {
  llm: LLMNode,
  usb: USBNode,
  output: OutputNode,
}

const initialNodes: Node[] = [
  {
    id: '1',
    type: 'usb',
    position: { x: 100, y: 100 },
    data: { label: 'USB Scanner' },
  },
  {
    id: '2',
    type: 'llm',
    position: { x: 300, y: 100 },
    data: { label: 'Document Analysis' },
  },
  {
    id: '3',
    type: 'output',
    position: { x: 500, y: 100 },
    data: { label: 'Results' },
  },
]

const initialEdges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2' },
  { id: 'e2-3', source: '2', target: '3' },
]

export function FlowBuilder() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  )

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNode(node)
  }, [])

  const addNode = useCallback((type: string) => {
    const newNode: Node = {
      id: `${Date.now()}`,
      type,
      position: { x: Math.random() * 400, y: Math.random() * 300 },
      data: { label: `${type} Node` },
    }
    setNodes((nds) => nds.concat(newNode))
  }, [setNodes])

  return (
    <div className="flex h-full">
      <NodeToolbox onAddNode={addNode} />
      
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          className="bg-background"
          fitView
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>

        <FlowControls selectedNode={selectedNode} />
      </div>
    </div>
  )
}