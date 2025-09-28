"use client"

import { useState, useEffect, useRef } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TrendingUp, TrendingDown, Play, MoreHorizontal, Sparkles } from "lucide-react"
import { apiService, EnhancedPlayData, GameTeams, GameState } from "@/lib/api"

interface ContextItem {
  id: string
  timestamp: string
  play: string
  context: string
  aiCommentary?: string
  contextInsights?: string
  impact: "positive" | "negative" | "neutral"
  winProbabilityChange: number
  category: "strategy" | "momentum" | "stats" | "prediction"
  hasReplay: boolean
  isAIGenerated: boolean
}

export function ContextFeed() {
  const [contextItems, setContextItems] = useState<ContextItem[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [gameTeams, setGameTeams] = useState<GameTeams>({ home_team: "Loading...", away_team: "Loading..." })
  const [gameState, setGameState] = useState<GameState>({
    homeTeam: "",
    awayTeam: "",
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

  // Use useRef to store current gameState for callbacks
  const gameStateRef = useRef(gameState)
  gameStateRef.current = gameState

  // Subscribe to real-time play data - NO DEPENDENCIES
  useEffect(() => {
    // Fetch team information for the current game
    const fetchTeams = async () => {
      try {
        const teams = await apiService.fetchGameTeams()
        setGameTeams(teams)
        // Update game state with team names
        setGameState(prev => ({
          ...prev,
          homeTeam: teams.home_team,
          awayTeam: teams.away_team
        }))
      } catch (error) {
        console.error('Failed to fetch team information:', error)
      }
    }

    fetchTeams()

    const handleNewPlay = (enhancedPlay: EnhancedPlayData) => {
      // Use ref to get current gameState to avoid stale closure
      const currentGameState = gameStateRef.current
      
      // Update game state from play
      const updatedGameState = apiService.updateGameStateFromPlay(enhancedPlay, currentGameState)
      setGameState(updatedGameState)

      const winProbChange = apiService.calculateWinProbabilityChange(enhancedPlay, updatedGameState)

      const newItem: ContextItem = {
        id: `${enhancedPlay.quarter}-${enhancedPlay.time}-${Date.now()}`,
        timestamp: `Q${enhancedPlay.quarter} ${calculateQuarterTime(enhancedPlay.time, enhancedPlay.quarter)}`,
        play: `${enhancedPlay.offense_team} ${enhancedPlay.down}${getOrdinalSuffix(enhancedPlay.down)} & ${enhancedPlay.yards_to_go}`,
        context: enhancedPlay.aiCommentary || apiService.generateContext(enhancedPlay, updatedGameState),
        aiCommentary: enhancedPlay.aiCommentary,
        contextInsights: enhancedPlay.contextInsights,
        impact: winProbChange > 0 ? "positive" : winProbChange < 0 ? "negative" : "neutral",
        winProbabilityChange: Math.round(winProbChange),
        category: getPlayCategory(enhancedPlay),
        hasReplay: enhancedPlay.yards_gained !== 0,
        isAIGenerated: !!(enhancedPlay.aiCommentary && enhancedPlay.aiCommentary !== 'Generating commentary...')
      }

      setContextItems((prev) => {
        // Check if this is an update to an existing item (same play ID but with AI commentary)
        const existingIndex = prev.findIndex(item => 
          item.id.startsWith(`${enhancedPlay.quarter}-${enhancedPlay.time}`)
        )
        
        if (existingIndex !== -1 && enhancedPlay.aiCommentary && enhancedPlay.aiCommentary !== 'Generating commentary...') {
          // Update existing item with AI commentary
          const updatedItems = [...prev]
          updatedItems[existingIndex] = { ...updatedItems[existingIndex], ...newItem }
          return updatedItems
        } else if (existingIndex === -1) {
          // New item
          return [newItem, ...prev.slice(0, 9)] // Keep only 10 items
        }
        
        return prev
      })

      setIsConnected(true)
      setConnectionError(null)
    }

    const handleConnectionStatus = (connected: boolean, error?: string) => {
      setIsConnected(connected)
      setConnectionError(error || null)
    }

    const handleGameStateUpdate = (newGameState: GameState) => {
      setGameState(newGameState)
    }

    // Subscribe to play updates, game state updates, and connection status
    apiService.subscribeToPlays(handleNewPlay)
    apiService.subscribeToConnectionStatus(handleConnectionStatus)
    apiService.subscribeToGameState(handleGameStateUpdate)

    return () => {
      apiService.unsubscribeFromPlays(handleNewPlay)
      apiService.unsubscribeFromConnectionStatus(handleConnectionStatus)
      apiService.unsubscribeFromGameState(handleGameStateUpdate)
    }
  }, []) // ✅ EMPTY DEPENDENCY ARRAY - this is the key fix!

  const getPlayCategory = (play: EnhancedPlayData): "strategy" | "momentum" | "stats" | "prediction" => {
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

  const calculateQuarterTime = (totalSecondsRemaining: number, quarter: number): string => {
    // Convert total game seconds to quarter-specific time
    const quarterLength = 15 * 60; // 15 minutes per quarter
    const quartersRemaining = 4 - quarter;
    const secondsFromFutureQuarters = quartersRemaining * quarterLength;
    const quarterTimeRemaining = totalSecondsRemaining - secondsFromFutureQuarters;
    
    const minutes = Math.floor(quarterTimeRemaining / 60);
    const seconds = quarterTimeRemaining % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  const formatTimeRemaining = (totalSeconds: number): string => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  const formatTimestamp = (timestamp: string): string => {
    // Since we're now using the actual game time, just return it as-is
    return timestamp
  }

  return (
    <div className="space-y-4">
      {/* Connection Status & Game Info */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-primary animate-pulse' : 'bg-destructive'}`} />
          <span className="text-xs text-muted-foreground">
            {isConnected ? 'Live data connected' : connectionError || 'Connecting...'}
          </span>
        </div>
        
        {gameTeams.home_team !== "Loading..." && (
          <div className="text-xs text-muted-foreground">
            {gameTeams.home_team} vs {gameTeams.away_team}
          </div>
        )}
      </div>

      {/* Current Game State */}
      {isConnected && (
        <Card className="p-3 bg-card border-border">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">
              {gameState.quarter} • {gameState.timeLeft}
            </div>
            <div className="text-sm">
              {gameState.homeTeam} {gameState.homeScore} - {gameState.awayScore} {gameState.awayTeam}
            </div>
          </div>
        </Card>
      )}

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
          className={`p-4 bg-card border-border transition-all duration-300 ${index === 0 ? "slide-in-up" : ""} ${
            item.isAIGenerated ? "ring-1 ring-primary/20" : ""
          }`}
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">{item.play}</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{formatTimestamp(item.timestamp)}</span>
            </div>
          </div>

          <p className="text-sm text-muted-foreground mb-2 leading-relaxed">{item.context}</p>

          {/* Context Insights */}
          {item.contextInsights && (
            <div className="text-xs text-muted-foreground mb-3 p-2 bg-muted/50 rounded border-l-2 border-primary/30">
              {item.contextInsights}
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {item.hasReplay && (
                <Button size="sm" variant="ghost" className="text-xs text-muted-foreground">
                  <Play className="w-3 h-3 mr-1" />
                  Watch Play
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