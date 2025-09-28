"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { X, Send, Sparkles, Clock, Target, TrendingUp } from "lucide-react"
import { apiService } from "@/lib/api"

interface ChatMessage {
  id: string
  type: "user" | "assistant"
  content: string
  timestamp: string
  suggestions?: string[]
}

interface AskGameChatProps {
  onClose: () => void
}

export function AskGameChat({ onClose }: AskGameChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      type: "assistant",
      content: "Hi! I'm your live game analyst. Ask me anything about what's happening in the game right now.",
      timestamp: "12:34 PM",
      suggestions: [
        "Why are they running so much?",
        "What's the win probability?",
        "Explain that last play call",
        "How does weather affect this game?",
      ],
    },
  ])
  const [inputValue, setInputValue] = useState("")

  const quickQuestions = [
    { icon: Clock, text: "Why are they running so much?", category: "Strategy" },
    { icon: Target, text: "Explain that play call", category: "Tactics" },
    { icon: TrendingUp, text: "What changed the momentum?", category: "Analysis" },
    { icon: Sparkles, text: "Predict next play", category: "Prediction" },
  ]

  const handleSendMessage = (content: string) => {
    if (!content.trim()) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: "user",
      content,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }

    // apiService.generateAIExplanation(content) // Call to backend (not implemented here)

    setMessages((prev) => [...prev, userMessage])
    setInputValue("")

    // Simulate AI response
    setTimeout(() => {
      const responses = {
        "Why are they running so much?": {
          content:
            "They're ahead 21-17 with 8 minutes left — running keeps the clock moving and lowers risk of turnovers. Their run game is averaging 4.2 yards per carry today, which is above their season average of 3.8.",
          suggestions: ["Show me their rushing stats", "Compare to league average", "What if they fall behind?"],
        },
        "Explain that play call": {
          content:
            "That was a play-action pass on 1st & 10. With their strong running game today, the defense bit on the fake, creating a 1-on-1 matchup downfield. Smart call given the game situation.",
          suggestions: ["Show success rate of play-action", "Why not run again?", "Defensive reaction analysis"],
        },
        "What changed the momentum?": {
          content:
            "The momentum shifted after that defensive sack 4 minutes ago. It dropped the Bills' win probability from 44% to 32% and forced them into a 3rd & long situation they couldn't convert.",
          suggestions: ["Show win probability chart", "Defensive pressure stats", "How to regain momentum?"],
        },
        "Predict next play": {
          content:
            "Based on down & distance (2nd & 7) and game situation, I predict a 65% chance of run, 35% pass. They've run on 78% of similar situations today when leading in the 4th quarter.",
          suggestions: ["Show play prediction accuracy", "Historical tendencies", "What would you call?"],
        },
      }

      const response = responses[content as keyof typeof responses] || {
        content:
          "Great question! Based on the current game state and historical data, here's what I can tell you about that situation...",
        suggestions: ["Tell me more", "Show the stats", "Compare to other games"],
      }

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: "assistant",
        content: response.content,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        suggestions: response.suggestions,
      }

      setMessages((prev) => [...prev, assistantMessage])
    }, 1000)
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
            <p className="text-xs text-muted-foreground">Live AI Analysis</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Quick Questions */}
      <div className="p-4 border-b border-border bg-secondary/20">
        <p className="text-sm text-muted-foreground mb-3">Quick Questions:</p>
        <div className="grid grid-cols-2 gap-2">
          {quickQuestions.map((question, index) => (
            <Button
              key={index}
              variant="outline"
              size="sm"
              className="justify-start gap-2 h-auto p-3 text-left bg-transparent"
              onClick={() => handleSendMessage(question.text)}
            >
              <question.icon className="w-4 h-4 text-primary" />
              <div>
                <div className="text-xs font-medium">{question.text}</div>
                <div className="text-xs text-muted-foreground">{question.category}</div>
              </div>
            </Button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] ${message.type === "user" ? "bg-primary text-primary-foreground" : "bg-card border border-border"} rounded-lg p-3`}
            >
              <p className="text-sm leading-relaxed">{message.content}</p>
              <p className="text-xs opacity-70 mt-2">{message.timestamp}</p>

              {message.suggestions && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs opacity-70">Follow-up questions:</p>
                  {message.suggestions.map((suggestion, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 mr-2 bg-transparent"
                      onClick={() => handleSendMessage(suggestion)}
                    >
                      {suggestion}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border bg-card">
        <div className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask about the game..."
            className="flex-1"
            onKeyPress={(e) => e.key === "Enter" && handleSendMessage(inputValue)}
          />
          <Button onClick={() => handleSendMessage(inputValue)} disabled={!inputValue.trim()} className="gap-2">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
