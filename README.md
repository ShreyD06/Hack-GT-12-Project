# GameSense 🏈⚡

**Real-time NFL Analytics with AI-Powered Insights**

GameSense is a live sports analytics platform that transforms NFL play-by-play data into intelligent, contextual insights using AI commentary, anomaly detection, and interactive chat features. Built for HackGT 12.

![GameSense Demo](https://img.shields.io/badge/Status-Live-green) ![Next.js](https://img.shields.io/badge/Next.js-15.5.4-black) ![FastAPI](https://img.shields.io/badge/FastAPI-Latest-009688) ![AI](https://img.shields.io/badge/AI-Google%20Gemini-blue)

## ✨ Features

### 🔴 Live Game Streaming
- **Real-time play updates** via Server-Sent Events (SSE)
- **Live scoreboard** with quarter tracking and game clock
- **Dynamic possession tracking** and down/distance display
- **Win probability calculations** based on game state

### 🤖 AI-Powered Commentary
- **Smart play analysis** using Google Gemini 2.0 Flash
- **Contextual insights** that explain why plays matter
- **Professional commentary** generation for each play
- **Interactive chat bot** for game-specific questions

### 📊 Advanced Analytics
- **Anomaly detection** for unusual team patterns
- **Trend analysis** for rushes/passes per drive
- **Statistical outlier identification** using Z-scores
- **Rolling window analysis** for performance trends

### 💬 Intelligent Chat System
- **Game-aware AI assistant** with full play history context
- **Smart suggestions** for follow-up questions
- **Real-time game insights** and strategic analysis

## 🏗️ Architecture

### Backend (FastAPI)
```
├── main.py                 # FastAPI server with streaming endpoints
├── pbp-2024.csv           # NFL play-by-play dataset (11MB)
└── Game Data Processing    # Team extraction and play preparation
```

### Frontend (Next.js 15)
```
sports-insights-app/
├── app/
│   ├── layout.tsx         # Root layout with theme provider
│   └── page.tsx           # Main GameSense dashboard
├── components/
│   ├── live-game-tile.tsx # Live game scoreboard component
│   ├── context-feed.tsx   # AI insights and play feed
│   ├── ask-game-chat.tsx  # Interactive chat interface
│   └── ui/               # Reusable UI components (Radix + shadcn/ui)
└── lib/
    ├── api.ts            # API service with SSE management
    └── AnomalyDetection.js # Statistical analysis engine
```

## 🚀 Quick Start

### Prerequisites
- **Python 3.8+** with pandas and FastAPI
- **Node.js 18+** and npm
- **Google Gemini API key** ([Get one here](https://aistudio.google.com/app/apikey))

### 1. Backend Setup
```bash
# Install Python dependencies
pip install fastapi pandas uvicorn python-multipart

# Start FastAPI server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Frontend Setup
```bash
# Navigate to frontend directory
cd sports-insights-app

# Install dependencies
npm install

# Add your Gemini API key to lib/api.ts (line 6)
# GEMINI_API_KEY = 'your-api-key-here'

# Start development server
npm run dev
```

### 3. Access GameSense
Open [http://localhost:3000](http://localhost:3000) to view the live dashboard!

## 📡 API Endpoints

### GET `/game-teams/{game_id}`
Retrieve team information for a specific game.
```json
{
  "home_team": "KC",
  "away_team": "LAC"
}
```

### GET `/stream-plays/{game_id}` 
Server-Sent Events stream for real-time play updates.
```javascript
data: {
  "quarter": 2,
  "time": 1847,
  "description": "P.Mahomes pass short right to T.Kelce for 12 yards",
  "yards_gained": 12,
  "offense_team": "KC",
  "defense_team": "LAC",
  "down": 2,
  "yards_to_go": 8,
  "yard_line": 35,
  "play_type": "PASS"
}
```

## 🧠 AI & Analytics Features

### Commentary Generation
The system generates contextual commentary using Google Gemini:
- **Situational awareness**: Red zone, 4th down, close games
- **Play significance**: Big plays, scoring drives, momentum shifts
- **Professional tone**: ESPN-style commentary with proper terminology

### Anomaly Detection Algorithm
```javascript
// Example: Detecting unusual rush patterns
const detector = new FootballAnomalyDetector();
const result = detector.detectTrendChanges(
  rushesPerDrive, 
  "Rushes per drive"
);
// Returns: trend changes, statistical outliers, sudden spikes
```

### Key Metrics Tracked
- **Rushes per drive** by team
- **Passes per drive** by team  
- **Completion rates** per drive
- **Win probability changes** based on plays
- **Drive efficiency** and time of possession

## 🎨 UI/UX Highlights

- **Modern Design**: Clean, mobile-first interface with dark/light theme support
- **Real-time Updates**: Live pulse animations and smooth transitions
- **Responsive Layout**: Optimized for desktop and mobile viewing
- **Accessibility**: Full keyboard navigation and screen reader support
- **Performance**: Optimized with React 18+ and Next.js 15 features

## 🔧 Tech Stack

### Backend
- **FastAPI**: High-performance Python web framework
- **Pandas**: Data manipulation and analysis
- **Asyncio**: Asynchronous streaming capabilities
- **CORS**: Cross-origin resource sharing for frontend integration

### Frontend
- **Next.js 15**: React framework with App Router
- **TypeScript**: Type-safe development
- **Tailwind CSS 4**: Utility-first styling
- **Radix UI**: Accessible component primitives
- **Lucide Icons**: Beautiful icon library
- **Google Gemini AI**: Advanced language model integration

### Data & Analytics
- **NFL Play-by-Play Data**: 2024 season dataset
- **Real-time Processing**: Efficient data streaming and caching
- **Statistical Analysis**: Custom anomaly detection algorithms
- **AI Integration**: Context-aware commentary generation

## 📈 Performance Features

- **Efficient Streaming**: Server-Sent Events with automatic reconnection
- **Smart Caching**: Team data and game state caching to reduce API calls
- **Optimized Renders**: React hooks and state management best practices
- **Error Handling**: Graceful degradation and connection recovery

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`  
5. Open a Pull Request

## 📄 License

This project was created for HackGT 12. Feel free to use and modify for educational purposes.

## 🏆 HackGT 12 Team

Built with ❤️ by the GameSense team for HackGT 12.

---

**Live Demo**: Experience real-time NFL analytics like never before! 🚀
