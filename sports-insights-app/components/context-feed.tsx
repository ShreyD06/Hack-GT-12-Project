"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TrendingUp, TrendingDown, Play, MoreHorizontal } from "lucide-react"
import { apiService, PlayData } from "@/lib/api"

interface ContextItem {
  id: string
  timestamp: string
  play: string
  context: string
  impact: "positive" | "negative" | "neutral"
  winProbabilityChange: number
  category: "strategy" | "momentum" | "stats" | "prediction"
  hasReplay: boolean
}

export function ContextFeed() {
  const [contextItems, setContextItems] = useState<ContextItem[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)

  // Subscribe to real-time play data
  useEffect(() => {
    const handleNewPlay = (play: PlayData) => {
      const context = apiService.generateContextFromPlay(play)
      const winProbChange = apiService.calculateWinProbabilityChange(play, {
        homeTeam: "WAS",
        awayTeam: "ATL",
        homeScore: 0,
        awayScore: 0,
        quarter: "1st",
        timeLeft: "15:00",
        possession: "home",
        down: 1,
        distance: 10,
        yardLine: 25,
        winProbability: { home: 50, away: 50 },
        driveInfo: { plays: 0, yards: 0, timeOfPossession: "0:00" }
      })

      const newItem: ContextItem = {
        id: `${play.quarter}-${play.time}-${Date.now()}`,
        timestamp: "Just now",
        play: `${play.offense_team} ${play.down}${getOrdinalSuffix(play.down)} & ${play.yards_to_go}`,
        context: context,
        impact: winProbChange > 0 ? "positive" : winProbChange < 0 ? "negative" : "neutral",
        winProbabilityChange: Math.round(winProbChange),
        category: getPlayCategory(play),
        hasReplay: play.yards_gained !== 0,
      }

      setContextItems((prev) => [newItem, ...prev.slice(0, 4)])
      setIsConnected(true)
      setConnectionError(null)
    }

    const handleConnectionStatus = (connected: boolean, error?: string) => {
      setIsConnected(connected)
      setConnectionError(error || null)
    }

    // Subscribe to play updates and connection status
    apiService.subscribeToPlays(handleNewPlay)
    apiService.subscribeToConnectionStatus(handleConnectionStatus)

    return () => {
      apiService.unsubscribeFromPlays(handleNewPlay)
      apiService.unsubscribeFromConnectionStatus(handleConnectionStatus)
    }
  }, [])

  const getPlayCategory = (play: PlayData): "strategy" | "momentum" | "stats" | "prediction" => {
    if (play.down === 4) return "strategy"
    if (play.yards_gained > 10 || play.yards_gained < -5) return "momentum"
    if (play.yard_line < 20) return "stats"
    return "prediction"
  }

  const getOrdinalSuffix = (num: number): string => {
    const suffixes = ["th", "st", "nd", "rd"]
    const v = num % 100
    return suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]
  }

  const getImpactIcon = (impact: string, change: number) => {
    if (change > 0) return <TrendingUp className="w-4 h-4 text-accent" />
    if (change < 0) return <TrendingDown className="w-4 h-4 text-destructive" />
    return <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "strategy":
        return "bg-primary/20 text-primary"
      case "momentum":
        return "bg-accent/20 text-accent"
      case "stats":
        return "bg-chart-3/20 text-chart-3"
      case "prediction":
        return "bg-chart-4/20 text-chart-4"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  return (
    <div className="space-y-4">
      {/* Connection Status */}
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-primary animate-pulse' : 'bg-destructive'}`} />
        <span className="text-xs text-muted-foreground">
          {isConnected ? 'Live data connected' : connectionError || 'Connecting...'}
        </span>
      </div>

      {contextItems.length === 0 && !connectionError && (
        <Card className="p-4 bg-card border-border">
          <div className="text-center text-muted-foreground">
            <div className="animate-pulse">Waiting for live play data...</div>
          </div>
        </Card>
      )}

      {contextItems.map((item, index) => (
        <Card
          key={item.id}
          className={`p-4 bg-card border-border transition-all duration-300 ${index === 0 ? "slide-in-up" : ""}`}
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              {getImpactIcon(item.impact, item.winProbabilityChange)}
              <span className="text-sm font-medium text-foreground">{item.play}</span>
              {item.winProbabilityChange !== 0 && (
                <Badge variant="outline" className="text-xs">
                  {item.winProbabilityChange > 0 ? "+" : ""}
                  {item.winProbabilityChange}%
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Badge className={`text-xs ${getCategoryColor(item.category)}`}>{item.category}</Badge>
              <span className="text-xs text-muted-foreground">{item.timestamp}</span>
            </div>
          </div>

          <p className="text-sm text-muted-foreground mb-3 leading-relaxed">{item.context}</p>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {item.hasReplay && (
                <Button size="sm" variant="outline" className="gap-2 h-8 bg-transparent">
                  <Play className="w-3 h-3" />
                  Replay
                </Button>
              )}
            </div>

            <Button size="sm" variant="ghost" className="text-xs text-muted-foreground">
              Learn More
            </Button>
          </div>
        </Card>
      ))}
    </div>
  )
}
