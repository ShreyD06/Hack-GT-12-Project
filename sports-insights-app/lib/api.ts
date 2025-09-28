import { GoogleGenAI } from '@google/genai';

const API_BASE_URL = 'http://localhost:8000'; // Adjust this to your FastAPI server URL

// Add your Gemini API key here or use environment variable
const GEMINI_API_KEY = process.env.REACT_APP_GEMINI_API_KEY; // Replace this with your real API key

// Initialize Gemini AI
let ai: GoogleGenAI | null = null;

if (GEMINI_API_KEY) {
  try {
    ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    console.log('Gemini AI initialized successfully');
  } catch (error) {
    console.error('Error initializing Gemini AI:', error);
  }
}

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
  play_type: string;
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

export interface EnhancedPlayData extends PlayData {
  aiCommentary?: string;
  contextInsights?: string;
}

class ApiService {
  private eventSource: EventSource | null = null;
  private playCallbacks: ((play: EnhancedPlayData) => void)[] = [];
  private gameStateCallbacks: ((gameState: GameState) => void)[] = [];
  private connectionCallbacks: ((connected: boolean, error?: string) => void)[] = [];
  private isConnected: boolean = false;
  private currentGameId: string = '2024122802'; // Default game ID
  private gameContext: {
    homeTeam: string;
    awayTeam: string;
    homeScore: number;
    awayScore: number;
  } = {
    homeTeam: '',
    awayTeam: '',
    homeScore: 0,
    awayScore: 0
  };

  // Initialize or reinitialize Gemini with API key
  initializeGemini(apiKey?: string) {
    const keyToUse = apiKey || GEMINI_API_KEY;
    if (keyToUse && keyToUse !== 'YOUR_ACTUAL_API_KEY_GOES_HERE') {
      try {
        ai = new GoogleGenAI({ apiKey: keyToUse });
        console.log('Gemini AI initialized successfully');
        return true;
      } catch (error) {
        console.error('Error initializing Gemini AI:', error);
        return false;
      }
    }
    return false;
  }

  // Fetch team information for a specific game
  async fetchGameTeams(gameId?: string): Promise<GameTeams> {
    const gameIdToUse = gameId || this.currentGameId;
    try {
      const response = await fetch(`${API_BASE_URL}/game-teams/${gameIdToUse}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const teams = await response.json();
      
      // Update game context
      this.gameContext.homeTeam = teams.home_team;
      this.gameContext.awayTeam = teams.away_team;
      
      return teams;
    } catch (error) {
      console.error('Error fetching game teams:', error);
      // Return fallback teams
      return { home_team: 'HOME', away_team: 'AWAY' };
    }
  }

  // Generate AI commentary using Gemini library
  async generateAICommentary(play: PlayData, gameState: GameState): Promise<string> {
    if (!ai) {
      console.error('Gemini AI not initialized. Please set your API key.');
      return 'AI Commentary unavailable - API key not configured';
    }

    try {
      const prompt = this.buildCommentaryPrompt(play, gameState);
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });
      
      const commentary = response.text;
      
      if (!commentary || commentary.trim().length === 0) {
        throw new Error('Empty commentary generated');
      }

      return commentary.trim();
    } catch (error) {
      console.error('Error generating Gemini commentary:', error);
      throw error; // Re-throw the error instead of using fallback
    }
  }

  // Build prompt for Gemini API
  private buildCommentaryPrompt(play: PlayData, gameState: GameState): string {
    const situationalContext = this.getSituationalContext(play, gameState);
    
    return `You are a professional NFL play-by-play commentator. Generate a clean, engaging commentary and explanation for this play.
    You are generating an explanation for someone who is fairly new to football.

Game Context:
- ${gameState.homeTeam} (Home) vs ${gameState.awayTeam} (Away)
- Score: ${gameState.homeTeam} ${gameState.homeScore} - ${gameState.awayTeam} ${gameState.awayScore}
- ${gameState.quarter} Quarter, ${gameState.timeLeft} remaining

Play Details:
- Down: ${play.down}, Distance: ${play.yards_to_go} yards
- Field Position: ${play.yard_line} yard line
- Offense: ${play.offense_team}
- Defense: ${play.defense_team}
- Yards Gained: ${play.yards_gained}
- Original Description: "${play.description}"

Situational Context: ${situationalContext}

Generate two sentences on two different lines.
Sentence 1: Generate a single, concise sentence of professional commentary (max 25 words) that:
1. Is exciting and engaging
2. Mentions the key result (yards gained/lost, scoring, etc.)
3. Uses proper NFL terminology
4. Maintains consistent team references
5. Captures the significance of the moment

Sentence 2: Generate a concise explanation (max 50 words) that:
1. Mentions the key result (yards gained/lost, scoring, etc.
2. Uses proper NFL terminology
3. Maintains consistent team references
4. Captures the significance of the moment
5. Explains why this play is important


Commentary:`;
  }

  async generateAIExplanation(play: PlayData, gameState: GameState): Promise<string> {
    if (!ai) {
      console.error('Gemini AI not initialized. Please set your API key.');
      return 'AI Commentary unavailable - API key not configured';
    }

    try {
      const prompt = this.buildCommentaryPromptExplainer(play, gameState);
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });
      
      const commentary = response.text;
      
      if (!commentary || commentary.trim().length === 0) {
        throw new Error('Empty commentary generated');
      }

      return commentary.trim();
    } catch (error) {
      console.error('Error generating Gemini commentary:', error);
      throw error; // Re-throw the error instead of using fallback
    }
  }

  // Build prompt for Gemini API
  private buildCommentaryPromptExplainer(play: PlayData, gameState: GameState): string {
    const situationalContext = this.getSituationalContext(play, gameState);
    
    return `You are a professional NFL play-by-play commentator. Generate a clean, engaging explanation for why this play is important.
    You are generating an explanation for someone who is fairly new to football.

Game Context:
- ${gameState.homeTeam} (Home) vs ${gameState.awayTeam} (Away)
- Score: ${gameState.homeTeam} ${gameState.homeScore} - ${gameState.awayTeam} ${gameState.awayScore}
- ${gameState.quarter} Quarter, ${gameState.timeLeft} remaining

Play Details:
- Down: ${play.down}, Distance: ${play.yards_to_go} yards
- Field Position: ${play.yard_line} yard line
- Offense: ${play.offense_team}
- Defense: ${play.defense_team}
- Yards Gained: ${play.yards_gained}
- Original Description: "${play.description}"

Situational Context: ${situationalContext}

Generate a concise explanation (max 50 words) that:
1. Mentions the key result (yards gained/lost, scoring, etc.
2. Uses proper NFL terminology
3. Maintains consistent team references
4. Captures the significance of the moment
5. Explains why this play is important

Commentary:`;
  }

  // Get situational context for better commentary
  private getSituationalContext(play: PlayData, gameState: GameState): string {
    const contexts = [];
    
    if (play.yard_line <= 20) {
      contexts.push("Red zone opportunity");
    }
    
    if (play.down === 4) {
      contexts.push("Critical 4th down");
    }
    
    if (play.yards_to_go >= 10) {
      contexts.push("Long distance situation");
    }
    
    if (gameState.quarter === "4th" && Math.abs(gameState.homeScore - gameState.awayScore) <= 7) {
      contexts.push("Close game in final quarter");
    }
    
    if (play.yards_gained >= 20) {
      contexts.push("Big play potential");
    }
    
    return contexts.length > 0 ? contexts.join(", ") : "Standard play situation";
  }

  // Generate AI analysis for play context
// Generate AI analysis for play context
async generatePlayAnalysis(play: PlayData, gameState: GameState): Promise<string> {
  if (!ai) {
    console.error('Gemini AI not initialized. Please set your API key.');
    return 'Analysis unavailable - API key not configured';
  }

  try {
    const analysisPrompt = `As an NFL analyst, provide tactical insights for this play:

Game Situation:
- ${gameState.homeTeam} vs ${gameState.awayTeam}
- Down: ${play.down}, Distance: ${play.yards_to_go}
- Field Position: ${play.yard_line} yard line
- Result: ${play.yards_gained} yards

Play: ${play.description}

Provide 1-2 sentences of tactical analysis focusing on strategy, execution, or impact.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: analysisPrompt,
      config: {
        thinkingConfig: {
          thinkingBudget: 0, // Disables thinking
        },
      },
    });

    if (response.text) {
      return response.text.trim();
    }

    // 🔹 Ensure we always return a string, even if response.text is missing
    return "Analysis unavailable - empty response";
  } catch (error) {
    console.error('Error generating play analysis:', error);
    return "Analysis unavailable - error generating analysis";
  }
}

  // Public method for generating context/commentary
  generateContext(play: PlayData, gameState?: GameState): string {
    // Since we removed fallback, this will be handled asynchronously
    return 'Loading AI commentary...';
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
  subscribeToPlays(callback: (play: EnhancedPlayData) => void) {
    this.playCallbacks.push(callback);
    console.log()
    
    if (!this.eventSource) {
      this.eventSource = new EventSource(`${API_BASE_URL}/stream-plays/${this.currentGameId}`);
      
      this.eventSource.onmessage = async (event) => {
        try {
          const playData: PlayData = JSON.parse(event.data);
          
          // Create initial enhanced play data with loading state
          const enhancedPlay: EnhancedPlayData = {
            ...playData,
            aiCommentary: 'Generating AI commentary...',
            contextInsights: this.generateContextInsights(playData)
          };
          
          // Send immediate callback with loading state
          this.playCallbacks.forEach(cb => cb(enhancedPlay));
          
          // Generate AI commentary asynchronously
          try {
            const gameState = this.getCurrentGameState(playData);
            const aiCommentary = await this.generateAICommentary(playData, gameState);
            // const aiExplanation = await this.generateAIExplanation(playData, gameState);
            
            // Send updated callback with AI commentary
            const finalEnhancedPlay: EnhancedPlayData = {
              ...enhancedPlay,
              aiCommentary
            };
            
            this.playCallbacks.forEach(cb => cb(finalEnhancedPlay));
          } catch (commentaryError) {
            // Send error state if commentary generation fails
            const errorPlay: EnhancedPlayData = {
              ...enhancedPlay,
              aiCommentary: 'AI commentary failed to generate'
            };
            
            this.playCallbacks.forEach(cb => cb(errorPlay));
          }
          
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

  // Generate context insights from play data
  private generateContextInsights(play: PlayData): string {
    const insights = [];
    
    if (play.yards_gained > 15) {
      insights.push(`Big play alert: ${play.yards_gained} yards`);
    }
    
    if (play.down === 4) {
      insights.push(`4th down: ${play.yards_to_go} yards needed`);
    }
    
    if (play.yard_line <= 20) {
      insights.push(`Red zone: ${play.yard_line} yards from end zone`);
    }
    
    if (play.yards_gained < -5) {
      insights.push(`Major loss: ${Math.abs(play.yards_gained)} yards back`);
    }
    
    return insights.join(' • ');
  }

  // Get current game state for context
  private getCurrentGameState(play: PlayData): GameState {
    return {
      homeTeam: this.gameContext.homeTeam || 'HOME',
      awayTeam: this.gameContext.awayTeam || 'AWAY',
      homeScore: this.gameContext.homeScore,
      awayScore: this.gameContext.awayScore,
      quarter: `${play.quarter}${this.getOrdinalSuffix(play.quarter)}`,
      timeLeft: this.formatTimeRemaining(play.time),
      possession: play.offense_team === this.gameContext.homeTeam ? "home" : "away",
      down: play.down,
      distance: play.yards_to_go,
      yardLine: play.yard_line,
      winProbability: { home: 50, away: 50 }, // Simplified for now
      driveInfo: { plays: 0, yards: 0, timeOfPossession: "0:00" }
    };
  }

  // Unsubscribe from play updates
  unsubscribeFromPlays(callback: (play: EnhancedPlayData) => void) {
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
        this.gameContext.homeScore += 6;
      } else {
        newGameState.awayScore += 6;
        this.gameContext.awayScore += 6;
      }
      // Reset drive info on touchdown
      newGameState.driveInfo = { plays: 0, yards: 0, timeOfPossession: "0:00" };
    } else if (description.includes('FIELD GOAL')) {
      if (play.offense_team === newGameState.homeTeam) {
        newGameState.homeScore += 3;
        this.gameContext.homeScore += 3;
      } else {
        newGameState.awayScore += 3;
        this.gameContext.awayScore += 3;
      }
      // Reset drive info on field goal
      newGameState.driveInfo = { plays: 0, yards: 0, timeOfPossession: "0:00" };
    } else if (description.includes('SAFETY')) {
      // Safety gives 2 points to the defense
      if (play.defense_team === newGameState.homeTeam) {
        newGameState.homeScore += 2;
        this.gameContext.homeScore += 2;
      } else {
        newGameState.awayScore += 2;
        this.gameContext.awayScore += 2;
      }
    } else if (description.includes('EXTRA POINT') && description.includes('GOOD')) {
      // Extra point conversion
      if (play.offense_team === newGameState.homeTeam) {
        newGameState.homeScore += 1;
        this.gameContext.homeScore += 1;
      } else {
        newGameState.awayScore += 1;
        this.gameContext.awayScore += 1;
      }
    } else if (description.includes('TWO-POINT') && description.includes('GOOD')) {
      // Two-point conversion
      if (play.offense_team === newGameState.homeTeam) {
        newGameState.homeScore += 2;
        this.gameContext.homeScore += 2;
      } else {
        newGameState.awayScore += 2;
        this.gameContext.awayScore += 2;
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

  // Set Gemini API key at runtime
  setGeminiApiKey(apiKey: string): boolean {
    return this.initializeGemini(apiKey);
  }
}

export const apiService = new ApiService();