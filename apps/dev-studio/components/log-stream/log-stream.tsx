'use client'

import { useEffect, useState } from 'react'
import { ScrollArea } from '@autoweave/ui'

interface LogEntry {
  timestamp: string
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  source: string
  metadata?: Record<string, any>
}

export function LogStream() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [wsStatus, setWsStatus] = useState<
    'connecting' | 'connected' | 'disconnected'
  >('connecting')

  useEffect(() => {
    const ws = new WebSocket(`${process.env.NEXT_PUBLIC_WS_URL}/logs`)

    ws.onopen = () => {
      setWsStatus('connected')
      console.log('Connected to log stream')
    }

    ws.onmessage = (event) => {
      const logEntry: LogEntry = JSON.parse(event.data)
      setLogs((prev) => [...prev.slice(-999), logEntry]) // Keep last 1000 logs
    }

    ws.onclose = () => {
      setWsStatus('disconnected')
      console.log('Disconnected from log stream')
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      setWsStatus('disconnected')
    }

    return () => {
      ws.close()
    }
  }, [])

  const getLevelColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'error':
        return 'text-red-500'
      case 'warn':
        return 'text-yellow-500'
      case 'info':
        return 'text-blue-500'
      case 'debug':
        return 'text-gray-500'
      default:
        return 'text-foreground'
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="text-lg font-semibold">Live Logs</h3>
        <div className="flex items-center space-x-2">
          <div
            className={`w-2 h-2 rounded-full ${
              wsStatus === 'connected'
                ? 'bg-green-500'
                : wsStatus === 'connecting'
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
            }`}
          />
          <span className="text-sm text-muted-foreground capitalize">
            {wsStatus}
          </span>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-1 font-mono text-sm">
          {logs.map((log, index) => (
            <div key={index} className="flex space-x-3">
              <span className="text-muted-foreground w-20 shrink-0">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              <span
                className={`w-12 shrink-0 uppercase ${getLevelColor(log.level)}`}
              >
                {log.level}
              </span>
              <span className="text-muted-foreground w-20 shrink-0">
                {log.source}
              </span>
              <span className="flex-1">{log.message}</span>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}