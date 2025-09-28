"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { X, Send, Sparkles, AlertCircle, Loader2 } from "lucide-react"
import { apiService } from "@/lib/api"



interface ChatMessage {
  id: string
  type: "user" | "assistant"
  content: string
  timestamp: string
  suggestions?: string[]
  isLoading?: boolean
  error?: boolean
}

interface AskGameChatProps {
  onClose: () => void
}

export function AskGameChat({ onClose }: AskGameChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      type: "assistant",
      content: "Hi! I'm your live game analyst. I have access to all the plays that have happened so far in this game. Ask me anything about the current situation, team performance, or any specific plays you'd like me to explain!",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      suggestions: [
        "What's the current game situation?",
        "How are the teams performing?",
        "Explain the last play"
      ]
    },
  ])
  const [inputValue, setInputValue] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSendMessage = async (content: string) => {
    if (!content.trim() || isGenerating) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: "user",
      content,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }

    // Add user message
    setMessages((prev) => [...prev, userMessage])
    setInputValue("")
    setIsGenerating(true)

    // Add loading message
    const loadingMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      type: "assistant",
      content: "Analyzing game data and generating response...",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      isLoading: true,
    }

    setMessages((prev) => [...prev, loadingMessage])

    try {
      // Generate AI response using the enhanced API service
      const { content: aiContent, suggestions } = await apiService.generateChatResponse(content)
      
      // Replace loading message with actual response
      const assistantMessage: ChatMessage = {
        id: loadingMessage.id,
        type: "assistant",
        content: aiContent,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        suggestions,
      }

      setMessages((prev) => 
        prev.map(msg => msg.id === loadingMessage.id ? assistantMessage : msg)
      )
    } catch (error) {
      console.error('Error generating chat response:', error)
      
      // Replace loading message with error message
      const errorMessage: ChatMessage = {
        id: loadingMessage.id,
        type: "assistant",
        content: "I'm sorry, I encountered an error while analyzing the game data. Please make sure the Gemini API key is configured correctly and try again.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        error: true,
        suggestions: [
          "Try asking again",
          "What's the current score?",
          "How many plays have happened?"
        ]
      }

      setMessages((prev) => 
        prev.map(msg => msg.id === loadingMessage.id ? errorMessage : msg)
      )
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    handleSendMessage(suggestion)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage(inputValue)
    }
  }

  return (
    <div className="flex flex-col h-full max-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Ask the Game</h2>
            <p className="text-xs text-muted-foreground">Live AI Analysis with Full Game Context</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] ${
                message.type === "user" 
                  ? "bg-primary text-primary-foreground" 
                  : message.error
                    ? "bg-destructive/10 border border-destructive/20"
                    : "bg-card border border-border"
              } rounded-lg p-3`}
            >
              {message.isLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <p className="text-sm">{message.content}</p>
                </div>
              ) : (
                <>
                  {message.error && (
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="w-4 h-4 text-destructive" />
                      <span className="text-xs text-destructive font-medium">Error</span>
                    </div>
                  )}
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                </>
              )}
              
              <p className={`text-xs mt-2 ${message.type === "user" ? "opacity-70" : "opacity-60"}`}>
                {message.timestamp}
              </p>

              {message.suggestions && !message.isLoading && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs opacity-70">Follow-up questions:</p>
                  <div className="flex flex-wrap gap-2">
                    {message.suggestions.map((suggestion, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        className="text-xs h-7 bg-transparent hover:bg-muted"
                        onClick={() => handleSuggestionClick(suggestion)}
                        disabled={isGenerating}
                      >
                        {suggestion}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border bg-card">
        <div className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={isGenerating ? "Generating response..." : "Ask about the game..."}
            className="flex-1"
            onKeyPress={handleKeyPress}
            disabled={isGenerating}
          />
          <Button 
            onClick={() => handleSendMessage(inputValue)} 
            disabled={!inputValue.trim() || isGenerating} 
            className="gap-2"
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
        
        {/* Quick action buttons */}
        <div className="flex flex-wrap gap-2 mt-3">
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-7"
            onClick={() => handleSendMessage("What's the current game situation?")}
            disabled={isGenerating}
          >
            Game Status
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-7"
            onClick={() => handleSendMessage("Explain the last play")}
            disabled={isGenerating}
          >
            Last Play
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-7"
            onClick={() => handleSendMessage("How are both teams performing so far?")}
            disabled={isGenerating}
          >
            Team Performance
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-7"
            onClick={() => handleSendMessage("What should the offense do next?")}
            disabled={isGenerating}
          >
            Strategy Advice
          </Button>
        </div>
      </div>
    </div>
  )
}