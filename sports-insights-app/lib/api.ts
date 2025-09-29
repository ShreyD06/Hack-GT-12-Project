import { GoogleGenAI } from '@google/genai';

const API_BASE_URL = 'http://localhost:8000';

// Get Gemini API key from environment variable
const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

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

export interface ChatMessage {
  id: string;
  type: "user" | "assistant";
  content: string;
  timestamp: string;
  suggestions?: string[];
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

  // Store play history for chat context
  private playHistory: EnhancedPlayData[] = [];
  private currentGameState: GameState | null = null;

  // Initialize or reinitialize Gemini with API key
  initializeGemini(apiKey?: string) {
    const keyToUse = apiKey || GEMINI_API_KEY;
    if (keyToUse && keyToUse !== 'your_actual_gemini_api_key_here') {
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

  // Generate chat response using Gemini with full game context
  async generateChatResponse(userQuestion: string): Promise<{
    content: string;
    suggestions: string[];
  }> {
    if (!ai) {
      throw new Error('Gemini AI not initialized. Please set your API key.');
    }

    try {
      const prompt = this.buildChatPrompt(userQuestion);
      
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
      });
      
      const fullResponse = response.text?.trim();
      
      if (!fullResponse) {
        throw new Error('Empty response generated');
      }

      // Parse the response to extract content and suggestions
      const { content, suggestions } = this.parseChatResponse(fullResponse);
      
      return { content, suggestions };
    } catch (error) {
      console.error('Error generating chat response:', error);
      throw error;
    }
  }

  // Build comprehensive chat prompt with game context
  private buildChatPrompt(userQuestion: string): string {
    const recentPlays = this.playHistory.slice(-10); // Last 10 plays for context
    const gameState = this.currentGameState;
    
    const playHistoryText = recentPlays.map((play, index) => 
      `Play ${index + 1}: Q${play.quarter} ${this.formatTimeRemaining(play.time, play.quarter)} - ${play.offense_team} ${play.down} & ${play.yards_to_go} at ${play.yard_line} yard line: ${play.description} (${play.yards_gained} yards)`
    ).join('\n');

    return `You are an expert NFL analyst providing real-time insights about an ongoing football game. Answer the user's question based on the current game context and play history.

CURRENT GAME STATUS:
- Teams: ${gameState?.homeTeam || this.gameContext.homeTeam} (Home) vs ${gameState?.awayTeam || this.gameContext.awayTeam} (Away)
- Score: ${gameState?.homeTeam || 'Home'} ${gameState?.homeScore || 0} - ${gameState?.awayTeam || 'Away'} ${gameState?.awayScore || 0}
- Current Situation: ${gameState?.quarter || '1st'} Quarter, ${gameState?.timeLeft || 'N/A'} remaining
- Possession: ${gameState?.possession === 'home' ? (gameState?.homeTeam || 'Home') : (gameState?.awayTeam || 'Away')}
- Down & Distance: ${gameState?.down || 'N/A'} & ${gameState?.distance || 'N/A'}
- Field Position: ${gameState?.yardLine || 'N/A'} yard line
- Win Probability: ${gameState?.homeTeam || 'Home'} ${gameState?.winProbability?.home || 50}% - ${gameState?.awayTeam || 'Away'} ${gameState?.winProbability?.away || 50}%

RECENT PLAY HISTORY:
${playHistoryText || 'No recent plays available'}

DRIVE INFO:
- Plays this drive: ${gameState?.driveInfo?.plays || 0}
- Yards this drive: ${gameState?.driveInfo?.yards || 0}
- Time of possession this drive: ${gameState?.driveInfo?.timeOfPossession || '0:00'}

USER QUESTION: "${userQuestion}"

Provide a comprehensive answer that consists of 1 paragraph maximum:
1. Directly addresses the user's question using specific game data
2. Explains it in terms that a beginner would understand
2. References relevant plays from the history when applicable
3. Explains the strategic context and implications
4. Uses proper NFL terminology
5. Keeps the response engaging and informative

After your main response, provide 3 relevant follow-up questions that the user might be interested in asking next, separated by "SUGGESTIONS:" on a new line.

Format your response exactly like this:
[Your detailed answer here]

SUGGESTIONS:
1. [First suggestion]
2. [Second suggestion] 
3. [Third suggestion]`;
  }

  // Parse chat response to extract content and suggestions
  private parseChatResponse(fullResponse: string): { content: string; suggestions: string[] } {
    const parts = fullResponse.split('SUGGESTIONS:');
    const content = parts[0].trim();
    
    let suggestions: string[] = [];
    if (parts[1]) {
      suggestions = parts[1]
        .trim()
        .split('\n')
        .map(line => line.replace(/^\d+\.\s*/, '').trim())
        .filter(suggestion => suggestion.length > 0)
        .slice(0, 3); // Limit to 3 suggestions
    }
    
    // Fallback suggestions if none were provided
    if (suggestions.length === 0) {
      suggestions = [
        "Tell me more about this situation",
        "What should they do next?",
        "Show me the key stats"
      ];
    }
    
    return { content, suggestions };
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

  // Get play history for chat context
  getPlayHistory(): EnhancedPlayData[] {
    return [...this.playHistory];
  }

  // Get current game state
  getCurrentGameState(): GameState | null {
    return this.currentGameState;
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
          
          // Update current game state
          if (this.currentGameState) {
            this.currentGameState = this.updateGameStateFromPlay(playData, this.currentGameState);
          } else {
            this.currentGameState = this.getCurrentGameStateFromPlay(playData);
          }
          
          // Create initial enhanced play data with loading state
          const enhancedPlay: EnhancedPlayData = {
            ...playData,
            aiCommentary: 'Generating AI commentary...',
            contextInsights: this.generateContextInsights(playData)
          };
          
          // Add to play history immediately
          this.playHistory.push(enhancedPlay);
          
          // Keep only last 50 plays to manage memory
          if (this.playHistory.length > 50) {
            this.playHistory = this.playHistory.slice(-50);
          }
          
          // Send immediate callback with loading state
          this.playCallbacks.forEach(cb => cb(enhancedPlay));
          
          // Generate AI commentary asynchronously
          try {
            const gameState = this.getCurrentGameStateFromPlay(playData);
            const aiCommentary = await this.generateAICommentary(playData, gameState);
            
            // Update the play in history with AI commentary
            const playIndex = this.playHistory.findIndex(p => 
              p.quarter === playData.quarter && 
              p.time === playData.time && 
              p.description === playData.description
            );
            
            if (playIndex !== -1) {
              this.playHistory[playIndex].aiCommentary = aiCommentary;
            }
            
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
            
            // Update in history
            const playIndex = this.playHistory.findIndex(p => 
              p.quarter === playData.quarter && 
              p.time === playData.time && 
              p.description === playData.description
            );
            
            if (playIndex !== -1) {
              this.playHistory[playIndex].aiCommentary = 'AI commentary failed to generate';
            }
            
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
  private getCurrentGameStateFromPlay(play: PlayData): GameState {
    return {
      homeTeam: this.gameContext.homeTeam || 'HOME',
      awayTeam: this.gameContext.awayTeam || 'AWAY',
      homeScore: this.gameContext.homeScore,
      awayScore: this.gameContext.awayScore,
      quarter: `${play.quarter}${this.getOrdinalSuffix(play.quarter)}`,
      timeLeft: this.formatTimeRemaining(play.time, play.quarter),
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
    newGameState.timeLeft = this.formatTimeRemaining(play.time, play.quarter);
    
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

  private formatTimeRemaining(totalSeconds: number, quarter: number): string {
    // takes totalSeconds and converts it to quarter, min:sec format
    const quarterLength = 15 * 60; // 15 minutes per quarter
    const quartersRemaining = 4 - quarter;
    const secondsFromFutureQuarters = quartersRemaining * quarterLength;
    const quarterTimeRemaining = totalSeconds - secondsFromFutureQuarters;
    
    const minutes = Math.floor(quarterTimeRemaining / 60);
    const seconds = quarterTimeRemaining % 60;
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
    this.playHistory = [];
    this.currentGameState = null;
  }

  // Set Gemini API key at runtime
  setGeminiApiKey(apiKey: string): boolean {
    return this.initializeGemini(apiKey);
  }
}

export const apiService = new ApiService();