'use client'

import { useState, useRef, useEffect } from 'react'
import { Button, Input, ScrollArea, Avatar, AvatarFallback, AvatarImage } from '@autoweave/ui'
import { Send, Mic, MicOff } from 'lucide-react'

interface Message {
  id: string
  content: string
  sender: 'user' | 'agent'
  timestamp: Date
  agentName?: string
}

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  const handleSendMessage = () => {
    if (!inputValue.trim()) return

    const newMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      sender: 'user',
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, newMessage])
    setInputValue('')

    // Simulate agent response
    setTimeout(() => {
      const agentResponse: Message = {
        id: (Date.now() + 1).toString(),
        content: `I received your message: "${inputValue}". How can I help you with that?`,
        sender: 'agent',
        timestamp: new Date(),
        agentName: 'Document Scanner',
      }
      setMessages((prev) => [...prev, agentResponse])
    }, 1000)
  }

  const toggleRecording = () => {
    setIsRecording(!isRecording)
    // Implement voice recording logic
  }

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
    }
  }, [messages])

  return (
    <div className="flex flex-col h-full" data-testid="chat-interface">
      <div className="border-b p-4">
        <h1 className="text-xl font-semibold">Chat with Agents</h1>
        <p className="text-sm text-muted-foreground">
          Start a conversation with your AutoWeave agents
        </p>
      </div>

      <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              data-testid={message.sender === 'user' ? 'message' : 'agent-message'}
            >
              <div
                className={`flex items-start space-x-2 max-w-xs lg:max-w-md ${
                  message.sender === 'user'
                    ? 'flex-row-reverse space-x-reverse'
                    : 'flex-row'
                }`}
              >
                <Avatar className="w-8 h-8">
                  <AvatarImage
                    src={
                      message.sender === 'user'
                        ? '/user-avatar.png'
                        : '/agent-avatar.png'
                    }
                  />
                  <AvatarFallback>
                    {message.sender === 'user' ? 'U' : 'A'}
                  </AvatarFallback>
                </Avatar>
                <div
                  className={`rounded-lg p-3 ${
                    message.sender === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  {message.sender === 'agent' && message.agentName && (
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      {message.agentName}
                    </p>
                  )}
                  <p className="text-sm">{message.content}</p>
                  <p
                    className={`text-xs mt-1 ${
                      message.sender === 'user'
                        ? 'text-primary-foreground/70'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {message.timestamp.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="border-t p-4">
        <div className="flex items-center space-x-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Type your message..."
            className="flex-1"
            data-testid="chat-input"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSendMessage()
              }
            }}
          />
          <Button
            size="icon"
            variant={isRecording ? 'destructive' : 'outline'}
            onClick={toggleRecording}
          >
            {isRecording ? (
              <MicOff className="h-4 w-4" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </Button>
          <Button onClick={handleSendMessage} disabled={!inputValue.trim()} data-testid="send-button">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}