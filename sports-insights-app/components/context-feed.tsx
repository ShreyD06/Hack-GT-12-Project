"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TrendingUp, TrendingDown, Play, MoreHorizontal } from "lucide-react"

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
  const [contextItems, setContextItems] = useState<ContextItem[]>([
    {
      id: "1",
      timestamp: "2 min ago",
      play: "4th & 1 Conversion",
      context:
        "Chiefs convert on 4th down with 78% success rate in this situation. Smart aggressive call maintains drive momentum.",
      impact: "positive",
      winProbabilityChange: 8,
      category: "strategy",
      hasReplay: true,
    },
    {
      id: "2",
      timestamp: "4 min ago",
      play: "Defensive Sack",
      context: "That sack drops Bills' 4th-quarter win probability by 12%. Forces punt from own territory.",
      impact: "negative",
      winProbabilityChange: -12,
      category: "momentum",
      hasReplay: true,
    },
    {
      id: "3",
      timestamp: "6 min ago",
      play: "Clock Management",
      context: "Chiefs slowing pace (3.2 seconds per snap) to protect 4-point lead. Textbook game management.",
      impact: "neutral",
      winProbabilityChange: 0,
      category: "strategy",
      hasReplay: false,
    },
    {
      id: "4",
      timestamp: "8 min ago",
      play: "Red Zone Entry",
      context:
        "Bills enter red zone for 3rd time. They're converting 67% of red zone trips today vs 58% season average.",
      impact: "positive",
      winProbabilityChange: 5,
      category: "stats",
      hasReplay: false,
    },
  ])

  // Simulate new context items
  useEffect(() => {
    const interval = setInterval(() => {
      const newContexts = [
        "Third down conversion extends drive - Bills now 6/8 on third downs today",
        "Timeout usage: Chiefs have 2 left, Bills have 1. Clock management becomes crucial.",
        "Weather factor: 15mph winds affecting passing game accuracy by 8%",
        "Injury update: Star receiver questionable, impacts red zone target distribution",
      ]

      const randomContext = newContexts[Math.floor(Math.random() * newContexts.length)]

      const newItem: ContextItem = {
        id: Date.now().toString(),
        timestamp: "Just now",
        play: "Live Update",
        context: randomContext,
        impact: Math.random() > 0.5 ? "positive" : "negative",
        winProbabilityChange: Math.floor(Math.random() * 10) - 5,
        category: "stats",
        hasReplay: false,
      }

      setContextItems((prev) => [newItem, ...prev.slice(0, 4)])
    }, 15000)

    return () => clearInterval(interval)
  }, [])

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
