"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Play, Clock, MapPin } from "lucide-react"
import { apiService, GameState, PlayData, EnhancedPlayData } from "@/lib/api"

export function LiveGameTile() {
  const [gameState, setGameState] = useState<GameState>({
    homeTeam: "Loading...",
    awayTeam: "Loading...",
    homeScore: 0,
    awayScore: 0,
    quarter: "1st",
    timeLeft: "15:00",
    possession: "home",
    down: 1,
    distance: 10,
    yardLine: 25,
    winProbability: {
      home: 50,
      away: 50,
    },
    driveInfo: {
      plays: 0,
      yards: 0,
      timeOfPossession: "0:00",
    },
  })

  // Fetch team information and subscribe to real-time play updates
  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const teams = await apiService.fetchGameTeams()
        setGameState(prevState => ({
          ...prevState,
          homeTeam: teams.home_team,
          awayTeam: teams.away_team
        }))
      } catch (error) {
        console.error('Failed to fetch team information:', error)
      }
    }

    fetchTeams()

    // Handle new play data - update local state without triggering callbacks
    const handleNewPlay = (play: EnhancedPlayData) => {
      setGameState(prevState => {
        // Create updated game state locally without calling the service method
        // that triggers callbacks to other components
        const updatedState = createUpdatedGameState(play, prevState)
        return updatedState
      })
    }

    // Handle direct game state updates
    const handleGameStateUpdate = (newGameState: GameState) => {
      setGameState(newGameState)
    }

    apiService.subscribeToPlays(handleNewPlay)
    apiService.subscribeToGameState(handleGameStateUpdate)

    return () => {
      apiService.unsubscribeFromPlays(handleNewPlay)
      apiService.unsubscribeFromGameState(handleGameStateUpdate)
    }
  }, [])

  return (
    <Card className="p-6 bg-card border-border live-pulse">
      {/* Game Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-primary rounded-full animate-pulse" />
          <span className="text-sm font-medium text-primary">LIVE</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span>
            {gameState.quarter} • {gameState.timeLeft}
          </span>
        </div>
      </div>

      {/* Score Display */}
      <div className="grid grid-cols-3 items-center gap-4 mb-6">
        <div className="text-center">
          <div className="text-2xl font-bold text-foreground">{gameState.awayScore}</div>
          <div className="text-sm text-muted-foreground">{gameState.awayTeam}</div>
        </div>

        <div className="text-center">
          <div className="text-xs text-muted-foreground mb-1">VS</div>
          <div className="w-12 h-1 bg-border rounded-full mx-auto" />
        </div>

        <div className="text-center">
          <div className="text-2xl font-bold text-foreground">{gameState.homeScore}</div>
          <div className="text-sm text-muted-foreground">{gameState.homeTeam}</div>
        </div>
      </div>

      {/* Down & Distance */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-foreground">
            {gameState.down}
            {getOrdinalSuffix(gameState.down)} & {gameState.distance} at {gameState.yardLine}
          </span>
        </div>

        <Button size="sm" variant="outline" className="gap-2 bg-transparent">
          <Play className="w-3 h-3" />
          Replay
        </Button>
      </div>
    </Card>
  )
}

// Local function to update game state without triggering service callbacks
function createUpdatedGameState(play: PlayData, currentGameState: GameState): GameState {
  const newGameState = { ...currentGameState }
  
  // Update quarter and time
  newGameState.quarter = `${play.quarter}${getOrdinalSuffix(play.quarter)}`
  newGameState.timeLeft = formatTimeRemaining(play.time)
  
  // Update possession
  newGameState.possession = play.offense_team === newGameState.homeTeam ? "home" : "away"
  
  // Update down and distance
  newGameState.down = play.down
  newGameState.distance = play.yards_to_go
  newGameState.yardLine = play.yard_line
  
  // Check for scoring plays based on description
  const description = play.description.toUpperCase()
  if (description.includes('TOUCHDOWN')) {
    if (play.offense_team === newGameState.homeTeam) {
      newGameState.homeScore += 6
    } else {
      newGameState.awayScore += 6
    }
    // Reset drive info on touchdown
    newGameState.driveInfo = { plays: 0, yards: 0, timeOfPossession: "0:00" }
  } else if (description.includes('FIELD GOAL')) {
    if (play.offense_team === newGameState.homeTeam) {
      newGameState.homeScore += 3
    } else {
      newGameState.awayScore += 3
    }
    // Reset drive info on field goal
    newGameState.driveInfo = { plays: 0, yards: 0, timeOfPossession: "0:00" }
  } else if (description.includes('SAFETY')) {
    // Safety gives 2 points to the defense
    if (play.defense_team === newGameState.homeTeam) {
      newGameState.homeScore += 2
    } else {
      newGameState.awayScore += 2
    }
  } else if (description.includes('EXTRA POINT') && description.includes('GOOD')) {
    // Extra point conversion
    if (play.offense_team === newGameState.homeTeam) {
      newGameState.homeScore += 1
    } else {
      newGameState.awayScore += 1
    }
  } else if (description.includes('TWO-POINT') && description.includes('GOOD')) {
    // Two-point conversion
    if (play.offense_team === newGameState.homeTeam) {
      newGameState.homeScore += 2
    } else {
      newGameState.awayScore += 2
    }
  } else {
    // Regular play - update drive info
    if (play.yards_gained !== 0) {
      newGameState.driveInfo.yards += play.yards_gained
    }
    newGameState.driveInfo.plays += 1
  }
  
  // Update win probability based on play impact
  const winProbChange = calculateWinProbabilityChange(play, newGameState)
  newGameState.winProbability.home = Math.max(0, Math.min(100, newGameState.winProbability.home + winProbChange))
  newGameState.winProbability.away = 100 - newGameState.winProbability.home
  
  return newGameState
}

// Local helper functions
function getOrdinalSuffix(num: number): string {
  const suffixes = ["th", "st", "nd", "rd"]
  const v = num % 100
  return suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]
}

function formatTimeRemaining(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function calculateWinProbabilityChange(play: PlayData, gameState: GameState): number {
  // Simplified win probability calculation based on play impact
  let change = 0
  
  // Factors that affect win probability
  if (play.yards_gained > 10) change += 2 // Big play
  if (play.yards_gained < -5) change -= 3 // Loss/sack
  if (play.down === 4 && play.yards_to_go > 5) change -= 5 // Difficult 4th down
  if (play.yard_line < 20) change += 3 // Red zone
  
  // Adjust based on which team is on offense
  if (play.offense_team !== gameState.homeTeam) {
    change = -change
  }
  
  return change
}