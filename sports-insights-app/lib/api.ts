// API service for connecting to FastAPI backend
const API_BASE_URL = 'http://localhost:8000'; // Adjust this to your FastAPI server URL

export interface PlayData {
  quarter: number;
  time: number;
  description: string;
  yards_gained: number;
  offense_team: string;
  defense_team: string;
  down: number;
  yards_to_go: number;
  yard_line: number;
}

export interface GameTeams {
  home_team: string;
  away_team: string;
}

export interface GameState {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  quarter: string;
  timeLeft: string;
  possession: "home" | "away";
  down: number;
  distance: number;
  yardLine: number;
  winProbability: {
    home: number;
    away: number;
  };
  driveInfo: {
    plays: number;
    yards: number;
    timeOfPossession: string;
  };
}

class ApiService {
  private eventSource: EventSource | null = null;
  private playCallbacks: ((play: PlayData) => void)[] = [];
  private gameStateCallbacks: ((gameState: GameState) => void)[] = [];
  private connectionCallbacks: ((connected: boolean, error?: string) => void)[] = [];
  private isConnected: boolean = false;
  private currentGameId: string = '2024122802'; // Default game ID

  // Fetch team information for a specific game
  async fetchGameTeams(gameId?: string): Promise<GameTeams> {
    const gameIdToUse = gameId || this.currentGameId;
    try {
      const response = await fetch(`${API_BASE_URL}/game-teams/${gameIdToUse}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const teams = await response.json();
      return teams;
    } catch (error) {
      console.error('Error fetching game teams:', error);
      // Return fallback teams
      return { home_team: 'HOME', away_team: 'AWAY' };
    }
  }

  // Set the current game ID
  setGameId(gameId: string) {
    this.currentGameId = gameId;
  }

  // Get the current game ID
  getGameId(): string {
    return this.currentGameId;
  }

  // Subscribe to live play updates via Server-Sent Events
  subscribeToPlays(callback: (play: PlayData) => void) {
    this.playCallbacks.push(callback);
    
    if (!this.eventSource) {
      this.eventSource = new EventSource(`${API_BASE_URL}/stream-plays/${this.currentGameId}`);
      
      this.eventSource.onmessage = (event) => {
        try {
          const playData: PlayData = JSON.parse(event.data);
          this.playCallbacks.forEach(cb => cb(playData));
          // Update connection status on successful message
          if (!this.isConnected) {
            this.isConnected = true;
            this.connectionCallbacks.forEach(cb => cb(true));
          }
        } catch (error) {
          console.error('Error parsing play data:', error);
        }
      };

      this.eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        this.isConnected = false;
        this.connectionCallbacks.forEach(cb => cb(false, 'Connection lost. Attempting to reconnect...'));
        
        // Attempt to reconnect after 5 seconds
        setTimeout(() => {
          if (this.eventSource?.readyState === EventSource.CLOSED) {
            this.eventSource = null;
            // Only reconnect if we still have callbacks
            if (this.playCallbacks.length > 0) {
              // Create new connection for all existing callbacks
              const callbacks = [...this.playCallbacks];
              this.playCallbacks = [];
              callbacks.forEach(cb => this.subscribeToPlays(cb));
            }
          }
        }, 5000);
      };
    }
  }

  // Unsubscribe from play updates
  unsubscribeFromPlays(callback: (play: PlayData) => void) {
    this.playCallbacks = this.playCallbacks.filter(cb => cb !== callback);
    
    if (this.playCallbacks.length === 0 && this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  // Subscribe to game state updates
  subscribeToGameState(callback: (gameState: GameState) => void) {
    this.gameStateCallbacks.push(callback);
  }

  // Unsubscribe from game state updates
  unsubscribeFromGameState(callback: (gameState: GameState) => void) {
    this.gameStateCallbacks = this.gameStateCallbacks.filter(cb => cb !== callback);
  }

  // Subscribe to connection status updates
  subscribeToConnectionStatus(callback: (connected: boolean, error?: string) => void) {
    this.connectionCallbacks.push(callback);
    // Immediately report current status
    callback(this.isConnected);
  }

  // Unsubscribe from connection status updates
  unsubscribeFromConnectionStatus(callback: (connected: boolean, error?: string) => void) {
    this.connectionCallbacks = this.connectionCallbacks.filter(cb => cb !== callback);
  }

  // Calculate win probability change from play data
  calculateWinProbabilityChange(play: PlayData, gameState: GameState): number {
    // Simplified win probability calculation based on play impact
    let change = 0;
    
    // Factors that affect win probability
    if (play.yards_gained > 10) change += 2; // Big play
    if (play.yards_gained < -5) change -= 3; // Loss/sack
    if (play.down === 4 && play.yards_to_go > 5) change -= 5; // Difficult 4th down
    if (play.yard_line < 20) change += 3; // Red zone
    
    // Adjust based on which team is on offense
    if (play.offense_team !== gameState.homeTeam) {
      change = -change;
    }
    
    return change;
  }

  // Update game state based on play data
  updateGameStateFromPlay(play: PlayData, currentGameState: GameState): GameState {
    const newGameState = { ...currentGameState };
    
    // Update quarter and time
    newGameState.quarter = `${play.quarter}${this.getOrdinalSuffix(play.quarter)}`;
    newGameState.timeLeft = this.formatTimeRemaining(play.time);
    
    // Update possession
    newGameState.possession = play.offense_team === newGameState.homeTeam ? "home" : "away";
    
    // Update down and distance
    newGameState.down = play.down;
    newGameState.distance = play.yards_to_go;
    newGameState.yardLine = play.yard_line;
    
    // Check for scoring plays based on description
    const description = play.description.toUpperCase();
    if (description.includes('TOUCHDOWN')) {
      if (play.offense_team === newGameState.homeTeam) {
        newGameState.homeScore += 6;
      } else {
        newGameState.awayScore += 6;
      }
      // Reset drive info on touchdown
      newGameState.driveInfo = { plays: 0, yards: 0, timeOfPossession: "0:00" };
    } else if (description.includes('FIELD GOAL')) {
      if (play.offense_team === newGameState.homeTeam) {
        newGameState.homeScore += 3;
      } else {
        newGameState.awayScore += 3;
      }
      // Reset drive info on field goal
      newGameState.driveInfo = { plays: 0, yards: 0, timeOfPossession: "0:00" };
    } else if (description.includes('SAFETY')) {
      // Safety gives 2 points to the defense
      if (play.defense_team === newGameState.homeTeam) {
        newGameState.homeScore += 2;
      } else {
        newGameState.awayScore += 2;
      }
    } else if (description.includes('EXTRA POINT') && description.includes('GOOD')) {
      // Extra point conversion
      if (play.offense_team === newGameState.homeTeam) {
        newGameState.homeScore += 1;
      } else {
        newGameState.awayScore += 1;
      }
    } else if (description.includes('TWO-POINT') && description.includes('GOOD')) {
      // Two-point conversion
      if (play.offense_team === newGameState.homeTeam) {
        newGameState.homeScore += 2;
      } else {
        newGameState.awayScore += 2;
      }
    } else {
      // Regular play - update drive info
      if (play.yards_gained !== 0) {
        newGameState.driveInfo.yards += play.yards_gained;
      }
      newGameState.driveInfo.plays += 1;
    }
    
    // Update win probability based on play impact
    const winProbChange = this.calculateWinProbabilityChange(play, newGameState);
    newGameState.winProbability.home = Math.max(0, Math.min(100, newGameState.winProbability.home + winProbChange));
    newGameState.winProbability.away = 100 - newGameState.winProbability.home;
    
    // Notify game state subscribers
    this.gameStateCallbacks.forEach(cb => cb(newGameState));
    
    return newGameState;
  }

  private getOrdinalSuffix(num: number): string {
    const suffixes = ["th", "st", "nd", "rd"];
    const v = num % 100;
    return suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0];
  }

  private formatTimeRemaining(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  // Generate context insights from play data
  generateContextFromPlay(play: PlayData): string {
    const insights = [];
    
    if (play.yards_gained > 15) {
      insights.push(`Big play! ${play.offense_team} gains ${play.yards_gained} yards.`);
    }
    
    if (play.down === 4) {
      insights.push(`Critical 4th down situation: ${play.yards_to_go} yards to go.`);
    }
    
    if (play.yard_line < 20) {
      insights.push(`${play.offense_team} enters the red zone with scoring opportunity.`);
    }
    
    if (play.yards_gained < 0) {
      insights.push(`Defensive stop! ${play.defense_team} holds ${play.offense_team} to a ${Math.abs(play.yards_gained)}-yard loss.`);
    }
    
    return insights.join(' ') || play.description;
  }

  // Cleanup method
  cleanup() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.playCallbacks = [];
    this.gameStateCallbacks = [];
    this.connectionCallbacks = [];
    this.isConnected = false;
  }
}

export const apiService = new ApiService();