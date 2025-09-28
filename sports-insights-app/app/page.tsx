"use client"

import { useState } from "react"
import { LiveGameTile } from "@/components/live-game-tile"
import { ContextFeed } from "@/components/context-feed"
import { AskGameChat } from "@/components/ask-game-chat"
import { Button } from "@/components/ui/button"
import { MessageCircle, TrendingUp, Zap } from "lucide-react"

export default function HomePage() {
  const [showChat, setShowChat] = useState(false)
  const [isLive, setIsLive] = useState(true)

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">GameSense</h1>
              <p className="text-xs text-muted-foreground">Live Insights</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isLive && (
              <div className="flex items-center gap-2 px-3 py-1 bg-primary/20 rounded-full">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                <span className="text-xs font-medium text-primary">LIVE</span>
              </div>
            )}
            <Button variant="ghost" size="sm" onClick={() => setShowChat(!showChat)} className="relative">
              <MessageCircle className="w-5 h-5" />
              {!showChat && <div className="absolute -top-1 -right-1 w-3 h-3 bg-accent rounded-full animate-pulse" />}
            </Button>
          </div>
        </div>
      </header>

      <main className="pb-20">
        {/* Live Game Section */}
        <section className="p-4">
          <LiveGameTile />
        </section>

        {/* Context Feed */}
        <section className="px-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Why This Matters</h2>
          </div>
          <ContextFeed />
        </section>
      </main>

      {/* Floating Ask Game Chat */}
      {showChat && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm">
          <AskGameChat onClose={() => setShowChat(false)} />
        </div>
      )}

    </div>
  )
}
