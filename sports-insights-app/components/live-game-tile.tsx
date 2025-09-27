"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Play, Clock, MapPin } from "lucide-react"
import { apiService, GameState, PlayData } from "@/lib/api"

export function LiveGameTile() {
  const [gameState, setGameState] = useState<GameState>({
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

  // Subscribe to real-time play updates
  useEffect(() => {
    const handleNewPlay = (play: PlayData) => {
      setGameState(prevState => {
        const updatedState = apiService.updateGameStateFromPlay(play, prevState)
        return updatedState
      })
    }

    const handleGameStateUpdate = (gameState: GameState) => {
      setGameState(gameState)
    }

    // Subscribe to play updates and game state changes
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

      {/* Win Probability */}
      <div className="mb-6">
        <div className="flex justify-between text-xs text-muted-foreground mb-2">
          <span>Win Probability</span>
          <span>
            {gameState.winProbability.home}% - {gameState.winProbability.away}%
          </span>
        </div>
        <div className="h-2 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-1000 ease-out"
            style={{ width: `${gameState.winProbability.home}%` }}
          />
        </div>
      </div>

      {/* Current Drive */}
      <div className="bg-secondary/50 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-foreground">Current Drive</span>
          <Badge variant="outline" className="text-xs">
            {gameState.possession === "home" ? gameState.homeTeam : gameState.awayTeam}
          </Badge>
        </div>

        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-lg font-bold text-accent">{gameState.driveInfo.plays}</div>
            <div className="text-xs text-muted-foreground">Plays</div>
          </div>
          <div>
            <div className="text-lg font-bold text-accent">{gameState.driveInfo.yards}</div>
            <div className="text-xs text-muted-foreground">Yards</div>
          </div>
          <div>
            <div className="text-lg font-bold text-accent">{gameState.driveInfo.timeOfPossession}</div>
            <div className="text-xs text-muted-foreground">TOP</div>
          </div>
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

function getOrdinalSuffix(num: number): string {
  const suffixes = ["th", "st", "nd", "rd"]
  const v = num % 100
  return suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]
}
