"use client"

import { useState, useEffect, useRef } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TrendingUp, TrendingDown, Play, MoreHorizontal, Sparkles } from "lucide-react"
import { apiService, EnhancedPlayData, GameTeams, GameState } from "@/lib/api"
import { el, pl } from "date-fns/locale"
import { anomalyDetect } from "@/lib/AnomalyDetection"

interface ContextItem {
  id: string
  timestamp: string
  play: string
  context: string
  aiCommentary?: string
  contextInsights?: string
  anomalySummary?: string[]
  impact: "positive" | "negative" | "neutral"
  winProbabilityChange: number
  category: "strategy" | "momentum" | "stats" | "prediction"
  hasReplay: boolean
  isAIGenerated: boolean
}

export var play_archive: EnhancedPlayData[] = []

// Function to check if a play is a key moment
function isKeyMoment(play: EnhancedPlayData): boolean {
  // Check for touchdown (reaching end zone)
  if (play.description.toLowerCase().includes("touchdown")) {
    return true
  }
  
  // Check for big yardage plays (20+ yards)
  if (Math.abs(play.yards_gained) >= 10) {
    return true
  }
  
  // Check for turnovers based on play description
  const description = play.description.toLowerCase()
  const turnoverKeywords = [
    'interception', 'fumble', 'recovered', 'intercepted', 
    'turnover', 'picked off', 'strip sack', 'forced fumble'
  ]

  if (turnoverKeywords.some(keyword => description.toLowerCase().includes(keyword))) {
    return true
  }
  
  // Check for 4th down conversions
  if (play.down === 4 && play.yards_gained >= play.yards_to_go) {
    return true
  }
  
  // Check for significant win probability changes (5% or more)
  // This will be calculated later in the function, but we can check for other criteria first
  
  return false
}

export function ContextFeed() {
  console.log("Rendering ContextFeed")
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
  // Stats for anomaly detection
  var rushes_per_drive_team1: number[] = []
  var rushes_per_drive_team2: number[] = []
  var passes_per_drive_team1: number[] = []
  var passes_per_drive_team2: number[] = []
  var completions_per_drive_team1: number[] = []
  var completions_per_drive_team2: number[] = []
  var rush_counter_team1 = 0
  var rush_counter_team2 = 0
  var pass_counter_team1 = 0
  var pass_counter_team2 = 0
  var completion_counter_team1 = 0
  var completion_counter_team2 = 0
  // Use useRef to store current gameState for callbacks
  const gameStateRef = useRef(gameState)
  gameStateRef.current = gameState
  // Track anomaly counts per stat to identify "new" anomalies
  const anomalyCountsRef = useRef<Record<string, number>>({})

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

      // Run anomaly detection on a simple rolling series (yards gained per play)
      // Build the series with recent plays of specific types plus the current one (if matching type)
      const allowedTypes = new Set(["PASS", "RUSH", "SCRAMBLE"])
      const historicalYards = play_archive
        .filter(p => allowedTypes.has(p.play_type))
        .map(p => p.yards_gained)
      const yardsSeries = allowedTypes.has(enhancedPlay.play_type)
        ? [...historicalYards, enhancedPlay.yards_gained]
        : historicalYards
      let hasNewAnomaly = false
      let anomalySummary: string[] | undefined = undefined
      const statName = "Yards per play"
      if (yardsSeries.length >= 6) {
        const res = anomalyDetect.detectTrendChanges(yardsSeries.slice(-30), statName)
        if (!('error' in res)) {
          const prevCount = anomalyCountsRef.current[statName] || 0
          const currentCount = res.anomalyDetails.length
          if (currentCount > prevCount) {
            hasNewAnomaly = true
            anomalyCountsRef.current[statName] = currentCount
            const narrative = anomalyDetect.generateNarrative(res)
            anomalySummary = Array.isArray(narrative) ? narrative : [narrative]
          } else {
            anomalyCountsRef.current[statName] = currentCount
          }
        }
      }

      // Check if this is a key moment before adding to ContextItems
      const isKey = isKeyMoment(enhancedPlay) || Math.abs(winProbChange) >= 5

      const newItem: ContextItem = {
        id: `${enhancedPlay.quarter}-${enhancedPlay.time}-${Date.now()}`,
        timestamp: `Q${enhancedPlay.quarter} ${calculateQuarterTime(enhancedPlay.time, enhancedPlay.quarter)}`,
        play: `${enhancedPlay.offense_team} ${enhancedPlay.down}${getOrdinalSuffix(enhancedPlay.down)} & ${enhancedPlay.yards_to_go}`,
        context: enhancedPlay.aiCommentary || apiService.generateContext(enhancedPlay, updatedGameState),
        aiCommentary: enhancedPlay.aiCommentary,
        contextInsights: enhancedPlay.contextInsights,
        anomalySummary: anomalySummary,
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
        } else if (existingIndex === -1 && (isKey || hasNewAnomaly)) {
          console.log(isKey, hasNewAnomaly)
          // Add if key moment or a new anomaly was detected for this play
          return [newItem, ...prev.slice(0, 9)] // Keep only 10 items
        }
        
        return prev
      })

      console.log(play_archive.length)
      console.log(enhancedPlay.description)

      // Update stats (on per-drive basis) for anomaly detection
      // This is what would be used normally, but for testing we will use the play yardage series above
      // since it takes to long to build up full drives in a demo
      if (enhancedPlay.play_type === "RUSH") {
        console.log("Rush detected")
        // check if new drive: if offense team changed
        if (play_archive.length > 0 && play_archive[play_archive.length - 1].offense_team !== enhancedPlay.offense_team) {
          if (enhancedPlay.offense_team === gameTeams.home_team) {
            rushes_per_drive_team2.push(rush_counter_team2)
            rush_counter_team2 = 0
            rush_counter_team2 ++
          } else {
            rushes_per_drive_team1.push(rush_counter_team1)
            rush_counter_team1 = 0
            rush_counter_team1 ++
          }
        } else {
          if (enhancedPlay.offense_team === gameTeams.home_team) {
            rush_counter_team2 ++
          } else {
            rush_counter_team1 ++
          }
        }
        
      } else if (enhancedPlay.play_type === "PASS") {
          console.log("Pass detected")
          if (play_archive.length > 0 && play_archive[play_archive.length - 1].offense_team !== enhancedPlay.offense_team) {
            if (enhancedPlay.offense_team === gameTeams.home_team) {
              passes_per_drive_team2.push(pass_counter_team2)
              pass_counter_team2 = 0
              pass_counter_team2 ++
            } else {
              passes_per_drive_team1.push(pass_counter_team1)
              pass_counter_team1 = 0
              pass_counter_team1 ++
            }
          } else {
            if (enhancedPlay.offense_team === gameTeams.home_team) {
              pass_counter_team2 ++
            } else {
              pass_counter_team1 ++
            }
          }
          if (enhancedPlay.description.toLowerCase().includes("incomplete") === false && play_archive[play_archive.length - 1].offense_team !== enhancedPlay.offense_team) {
            if (enhancedPlay.offense_team === gameTeams.home_team) {
              completions_per_drive_team2.push(completion_counter_team2)
              completion_counter_team2 = 0
              completion_counter_team2 ++
            } else {
              completions_per_drive_team1.push(completion_counter_team1)
              completion_counter_team1 = 0
              completion_counter_team1 ++
            }
          } else if (enhancedPlay.description.toLowerCase().includes("incomplete") === false) {
            if (enhancedPlay.offense_team === gameTeams.home_team) {
              completion_counter_team2 ++
            } else {
              completion_counter_team1 ++
            }
          }

        }
      // Add play to archive
      play_archive.push(enhancedPlay)

      // run Anomaly Detection
      // const res = anomalyDetect.detectTrendChanges(rushes_per_drive_team1, "Rushes per drive")
      // console.log(res)
      const res = anomalyDetect.detectTrendChanges([0, 1, 2, 3, 6, 10, 3, 1, 5], "Rushes per drive")
      console.log(res['summary'])
      console.log(anomalyDetect.generateNarrative(res))

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

          {item.anomalySummary && item.anomalySummary.length > 0 && (
            <div className="mb-3 p-3 rounded-md border border-accent/40 bg-accent/10">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-4 h-4 text-accent" />
                <span className="text-xs font-semibold text-accent">Trend Report</span>
              </div>
              <ul className="list-disc list-inside space-y-1">
                {item.anomalySummary.map((line, i) => (
                  <li key={i} className="text-xs text-foreground">{line}</li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-sm text-muted-foreground mb-2 leading-relaxed">{item.context}</p>


        </Card>
      ))}
    </div>
  )
}