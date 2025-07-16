import { AgentSidebar } from '@/components/agent-sidebar'
import { ChatInterface } from '@/components/chat-interface'

export default function HomePage() {
  return (
    <div className="flex h-screen bg-background">
      <AgentSidebar />
      <main className="flex-1 flex flex-col">
        <ChatInterface />
      </main>
    </div>
  )
}