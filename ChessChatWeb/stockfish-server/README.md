# Stockfish HTTP Server

Standalone HTTP server for Stockfish chess engine integration with Cloudflare Workers.

## Features

- ✅ Native Stockfish engine via `stockfish` npm package
- ✅ RESTful API for move computation and position analysis
- ✅ Configurable CPU difficulty levels (1-10)
- ✅ API key authentication
- ✅ Health check endpoint
- ✅ Docker support for production deployment
- ✅ Comprehensive test suite

## Quick Start

### Local Development

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env and set STOCKFISH_API_KEY

# Start server
npm start

# In another terminal, run tests
npm test
```

Server will be available at `http://localhost:3001`

### Docker Deployment

```bash
# Build image
docker build -t stockfish-server:latest .

# Run with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f

# Run tests
npm test
```

## API Endpoints

### GET /health

Health check endpoint.

**Response**:
```json
{
  "status": "healthy",
  "service": "stockfish-server",
  "version": "1.0.0",
  "timestamp": "2025-12-29T..."
}
```

### POST /compute-move

Compute best move for a given position.

**Headers**:
- `Content-Type: application/json`
- `Authorization: Bearer <API_KEY>`

**Request Body**:
```json
{
  "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  "cpuLevel": 5
}
```

**Response**:
```json
{
  "success": true,
  "move": "e2e4",
  "cpuLevel": 5,
  "computeTimeMs": 250,
  "timestamp": "2025-12-29T..."
}
```

### POST /analyze

Analyze a position and return evaluation.

**Headers**:
- `Content-Type: application/json`
- `Authorization: Bearer <API_KEY>`

**Request Body**:
```json
{
  "fen": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
  "depth": 15
}
```

**Response**:
```json
{
  "success": true,
  "evaluation": 0.3,
  "bestMove": "e7e5",
  "depth": 15,
  "computeTimeMs": 500,
  "timestamp": "2025-12-29T..."
}
```

## Configuration

### Environment Variables

- `PORT`: Server port (default: 3001)
- `STOCKFISH_API_KEY`: API key for authentication (required)
- `NODE_ENV`: Environment (`development` or `production`)

### CPU Levels

| Level | Depth | Skill | Think Time | Difficulty |
|-------|-------|-------|------------|------------|
| 1     | 1     | 0     | 50ms       | Beginner   |
| 2     | 2     | 2     | 100ms      | Easy       |
| 3     | 3     | 5     | 150ms      | Easy+      |
| 4     | 5     | 8     | 200ms      | Medium-    |
| 5     | 8     | 10    | 300ms      | Medium     |
| 6     | 10    | 12    | 400ms      | Medium+    |
| 7     | 13    | 15    | 500ms      | Hard       |
| 8     | 16    | 17    | 750ms      | Hard+      |
| 9     | 18    | 19    | 1000ms     | Expert     |
| 10    | 20    | 20    | 2000ms     | Master     |

## Testing

Run the test suite:

```bash
npm test
```

Tests include:
- ✅ Health check
- ✅ Compute move (starting position)
- ✅ Invalid FEN handling
- ✅ Unauthorized access handling
- ✅ Position analysis

## Deployment

See [DEPLOYMENT_GUIDE_OPTION_B.md](../DEPLOYMENT_GUIDE_OPTION_B.md) for complete deployment instructions.

### Cloud Platform Recommendations

- **Railway.app**: Easiest, ~$5-10/month
- **Render.com**: Simple, $7/month
- **Fly.io**: Flexible, ~$5-15/month
- **DigitalOcean**: VPS control, $6/month

## Integration with Cloudflare Worker

The Worker API integrates with this server via HTTP:

```typescript
import { StockfishEngine } from './stockfish';

const stockfish = new StockfishEngine({
  STOCKFISH_SERVER_URL: 'https://your-server.com',
  STOCKFISH_API_KEY: 'your-api-key'
});

const result = await stockfish.computeMove({
  fen: '...',
  cpuLevel: 5,
  timeMs: 5000
});
```

## Security

- API key authentication required for all endpoints (except /health)
- CORS enabled for development (restrict in production)
- Rate limiting recommended for public deployments
- Use HTTPS in production

## Troubleshooting

### Server won't start

- Check Node.js version (requires 18+)
- Verify dependencies installed: `npm install`
- Check port not in use: `netstat -ano | findstr :3001`

### Tests failing

- Ensure server is running: `npm start`
- Check API key matches in test script
- Verify network connectivity to server

### Slow move computation

- Check CPU resources on server
- Reduce CPU level for testing
- Consider larger server instance

## License

MIT
