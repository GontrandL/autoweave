'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const data = [
  { time: '00:00', cpu: 65, memory: 68, disk: 45 },
  { time: '04:00', cpu: 59, memory: 72, disk: 48 },
  { time: '08:00', cpu: 80, memory: 85, disk: 52 },
  { time: '12:00', cpu: 81, memory: 88, disk: 55 },
  { time: '16:00', cpu: 56, memory: 75, disk: 58 },
  { time: '20:00', cpu: 55, memory: 70, disk: 60 },
  { time: '24:00', cpu: 40, memory: 65, disk: 62 },
]

export function SystemMetrics() {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="cpu" stroke="#8884d8" strokeWidth={2} />
          <Line type="monotone" dataKey="memory" stroke="#82ca9d" strokeWidth={2} />
          <Line type="monotone" dataKey="disk" stroke="#ffc658" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}