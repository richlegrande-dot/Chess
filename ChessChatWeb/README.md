# ChessChat with Wall-E 🤖

**Your Friendly Chess Coaching Companion**

ChessChat is a web-based chess learning platform featuring Wall-E, an encouraging AI coach who helps you improve your game with personalized feedback and tactical guidance.

<!-- Database persistence enabled: December 23, 2025 -->

**Live at:** [https://chesschat.uk](https://chesschat.uk)

---

## Features

### 🤖 Wall-E: Your Chess Coach
- **Friendly Personality** - Encouraging, patient, and supportive coaching style
- **Personalized Feedback** - Custom advice based on your skill level and mistakes
- **Tactical Analysis** - Identifies blunders, missed tactics, and strategic issues
- **Learning System** - Tracks your progress and adapts coaching to your needs
- **Training Data Collection** - Every game helps Wall-E become smarter

### Core Gameplay
- ♟️ **Full Chess Game** - Play as White against AI as Black with complete rules
- 🎯 **Coaching Mode** - Get detailed post-game analysis from Wall-E
- 💬 **Interactive Learning** - Understand your mistakes with clear explanations
- 📊 **Progress Tracking** - Monitor your improvement over time
- 🧠 **Training Data Bank** - Export your games for custom LLM training

### User Experience (Version 1.0 RC)
- 🏠 **Landing Screen** - Welcome page with Wall-E's friendly greeting
- 🎨 **Polished UI** - Clean, gradient-based design with Wall-E theme colors
- ⏳ **AI Thinking Indicator** - "Wall-E is thinking..." animations
- ▶️ **Turn Indicators** - Clear visual feedback for game state
- ⚠️ **User-Friendly Errors** - Wall-E's encouraging error messages
- ℹ️ **About Screen** - Comprehensive info on features and privacy

### Technical Architecture
- 🔄 **Self-Healing** - Automatic recovery from failures
  - Circuit breaker pattern to prevent cascading failures
  - Exponential backoff retry logic (3 attempts)
  - Automatic rate limit handling
  - Graceful degradation under load
- 🏥 **Health Monitoring** - Real-time service status
  - Recurring health checks every 5 minutes
  - Circuit breaker state monitoring
  - API connectivity checks
  - `/api/health` endpoint for status
- 💾 **State Persistence** - Training data saved in localStorage
- 🔐 **Security Headers** - HSTS, CSP, CORS protection

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Chess Engine**: chess.js + custom AI
- **State Management**: Zustand
- **Backend**: Cloudflare Pages Functions
- **Database**: PostgreSQL (Prisma + Prisma Accelerate)
- **Deployment**: Cloudflare Pages (chesschat.uk)
- **Domain**: Custom domain with SSL/TLS

## Live Deployment

**Production URL:** [https://chesschat.uk](https://chesschat.uk)

- ✅ Custom domain with Cloudflare
- ✅ Automatic HTTPS/SSL
- ✅ Global CDN distribution
- ✅ WWW → Apex redirect
- ✅ SPA routing enabled

See [docs/CUSTOM_DOMAIN_SETUP.md](docs/CUSTOM_DOMAIN_SETUP.md) for deployment details.

## Development

### Prerequisites

- Node.js 18+ 
- npm or pnpm
- Cloudflare account (for deployment)

### Setup

```bash
# Install dependencies
npm install

# Set up environment variables (create .dev.vars for local development)
# OPENAI_API_KEY=your_openai_api_key_here

# Run development server
npm run dev
```

Visit `http://localhost:3000`

### Build

```bash
npm run build
```

### Deploy to Cloudflare

```bash
# First time: Configure wrangler
npx wrangler login

# Set environment variables in Cloudflare
npx wrangler pages secret put OPENAI_API_KEY

# Deploy
npm run deploy
```

## Project Structure

```
ChessChatWeb/
├── src/
│   ├── components/        # React components
│   │   ├── HomeView.tsx          # Landing screen (v1.0 RC)
│   │   ├── ModelSelection.tsx    # User-friendly AI picker (v1.0 RC)
│   │   ├── GameSummary.tsx       # Post-game statistics (v1.0 RC)
│   │   ├── AboutView.tsx         # About/features screen (v1.0 RC)
│   │   ├── ChessBoard.tsx        # Interactive chess board
│   │   ├── GameView.tsx          # Main gameplay view
│   │   ├── PostGameChat.tsx      # AI analysis chat
│   │   └── Settings.tsx          # Settings modal
│   ├── lib/              # Core logic
│   │   ├── models.ts     # AI model definitions
│   │   ├── chess.ts      # Chess utilities
│   │   └── api.ts        # API client with retry logic
│   ├── store/            # Zustand state management
│   │   └── gameStore.ts  # Game state + user-friendly errors
│   ├── styles/           # CSS
│   │   ├── HomeView.css          # Landing screen styles
│   │   ├── ModelSelection.css    # Model picker styles
│   │   ├── GameSummary.css       # Summary screen styles
│   │   ├── AboutView.css         # About screen styles
│   │   ├── GameView.css          # Gameplay styles + indicators
│   │   └── global.css            # Base styles
│   ├── App.tsx           # Main navigation router (6 views)
│   └── main.tsx
├── functions/            # Cloudflare Functions
│   └── api/
│       ├── chess-move.ts   # AI move generation with self-healing
│       ├── chat.ts         # Post-game chat with self-healing
│       └── health.ts       # Health monitoring endpoint
├── public/               # Static assets
├── dist/                # Build output
├── archive/             # Legacy code and documentation
├── WEB_ONBOARDING_GUIDE.md  # User getting started guide
└── WEB_ONLY_POLICY.md   # Web-only development policy
```

## Environment Variables

### Required (Cloudflare Pages)

- `OPENAI_API_KEY` - OpenAI API key for AI opponents and chat

### Local Development

Create `.dev.vars` in the root directory:

```
OPENAI_API_KEY=sk-...
```

## API Endpoints

### POST /api/chess-move

Generate AI chess move with self-healing.

**Request:**
```json
{
  "fen": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
  "pgn": "1. e4",
  "model": "gpt-4o-mini"
}
```

**Response:**
```json
{
  "success": true,
  "move": "e7e5",
  "retryCount": 0,
  "responseTime": 1234,
  "circuitBreakerState": "CLOSED"
}
```

**Error Response (with recovery info):**
```json
{
  "success": false,
  "error": "Rate limit: 429",
  "retryCount": 3,
  "recoveryAction": "All retry attempts exhausted. Service will auto-recover.",
  "circuitBreakerState": "OPEN"
}
```

### POST /api/chat

Post-game analysis chat with self-healing.

**Request:**
```json
{
  "message": "Where did I go wrong?",
  "gameContext": {
    "finalFEN": "...",
    "pgn": "1. e4 e5 2. Nf3...",
    "result": "Checkmate - Black wins"
  },
  "chatHistory": [],
  "model": "gpt-4o-mini"
}
```

**Response:**
```json
{
  "success": true,
  "response": "Looking at your game...",
  "retryCount": 1,
  "responseTime": 2345,
  "recoveryAction": "Recovered after 1 retry",
  "circuitBreakerState": "CLOSED"
}
```

### GET /api/health

Service health status and monitoring.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-12-10T10:30:00.000Z",
  "uptime": 3600000,
  "checks": {
    "apiKey": true,
    "openAIConnectivity": true
  },
  "circuitBreakers": {
    "chessMove": {
      "state": "CLOSED",
      "failures": 0,
      "lastFailureTime": null
    },
    "chat": {
      "state": "CLOSED",
      "failures": 0,
      "lastFailureTime": null
    }
  }
}
```

**Query Parameters:**
- `?test=true` - Test OpenAI connectivity (slower)
- `?metrics=true` - Include detailed metrics

## Self-Healing Features

ChessChat Web includes comprehensive self-healing capabilities:

- **Circuit Breaker Pattern**: Prevents cascading failures by temporarily blocking requests when error rates exceed threshold
- **Exponential Backoff Retry**: Automatically retries failed requests up to 3 times with increasing delays (1s, 2s, 4s)
- **Rate Limit Handling**: Detects and recovers from OpenAI API rate limits automatically
- **Health Monitoring**: Recurring health checks every 5 minutes via Cloudflare Cron Triggers
- **Automatic Recovery**: Service automatically recovers from temporary failures without manual intervention

See [SELF_HEALING.md](./SELF_HEALING.md) for detailed documentation.

### Monitoring Health Status

```bash
# Check service health
curl https://chesschat-web.pages.dev/api/health

# Test OpenAI connectivity
curl https://chesschat-web.pages.dev/api/health?test=true

# Get detailed metrics
curl https://chesschat-web.pages.dev/api/health?metrics=true
```

### Circuit Breaker States

- **CLOSED**: Normal operation, all requests processed
- **OPEN**: Service protection mode, requests rejected to prevent overload
- **HALF_OPEN**: Testing recovery, limited requests allowed through

## License

MIT

## Getting Started (Users)

See [WEB_ONBOARDING_GUIDE.md](./WEB_ONBOARDING_GUIDE.md) for a complete user guide including:
- How to play your first game
- Understanding AI model choices
- Using the game summary and chat analysis
- Troubleshooting common issues

## 🆕 New Features (Phase 7-9)

### Phase 7: CoachEngine
- **Self-Contained Coaching System**: No external AI APIs for coaching
- **Knowledge Vault**: Curated chess content (52 chunks across 4 sources)
  - Chess Tactics (14 patterns)
  - Opening Principles (13 concepts)
  - Endgame Fundamentals (15 concepts)
  - Popular Openings (10 openings)
- **Smart Search**: Relevance-scored knowledge retrieval
- **Admin Portal**: Manage knowledge sources and chunks
- **CoachEngine Testing Interface**: Test coaching algorithms

### Phase 8: CoachEngine Integration
- **Coaching Panel**: In-game coaching insights
- **Game Phase Detection**: Automatic opening/middlegame/endgame detection
- **Quick Topic Buttons**: Phase-appropriate coaching shortcuts
- **useCoaching Hook**: React integration for coaching features
- **Expandable Knowledge Chunks**: Click to see full explanations

### Phase 9: Comprehensive Documentation
- **Architecture Docs**: System design and component interaction
- **API Reference**: Complete endpoint documentation
- **User Guide**: How to play and use features
- **Developer Guide**: Development workflows and patterns
- **Deployment Guide**: Step-by-step Cloudflare deployment

**📚 Full Documentation**: See [`docs/`](./docs) folder for detailed guides.

## Version History

### v1.1.0 (December 2025) - CoachEngine & Documentation
- ✅ CoachEngine: Self-contained coaching system
- ✅ Knowledge Vault: 52 curated chess concepts
- ✅ Coaching Panel: In-game insights UI
- ✅ Game Phase Detection: Auto-detect opening/middlegame/endgame
- ✅ Admin Portal: Knowledge management interface
- ✅ Comprehensive Documentation: 7+ detailed guides

### v1.0.0 RC (December 2025) - Public Release Candidate
- ✅ Landing screen for general players
- ✅ User-friendly model selection with badges
- ✅ Game summary screen with statistics
- ✅ About screen with features/tech/privacy
- ✅ AI thinking and turn indicators
- ✅ Improved error messages (non-technical)
- ✅ Error dismissal and auto-timeout
- ✅ Complete navigation flow (6 views)

### v0.2.0 (December 2025) - Self-Healing
- Circuit breaker pattern
- Health monitoring endpoint
- Exponential backoff retry logic
- Rate limit handling

### v0.1.0 (December 2025) - Initial Web Version
- Full chess gameplay
- Multiple AI models
- Post-game chat analysis

## Credits

Built for universal accessibility across all platforms via modern web technologies.

For details on the web-only development approach, see [WEB_ONLY_POLICY.md](./WEB_ONLY_POLICY.md).

<!-- Trigger deployment with DATABASE_URL - 12/23/2025 23:53:45 -->
