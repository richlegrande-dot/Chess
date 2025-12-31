# API Reference

**Last Updated**: December 18, 2025  
**Version**: 1.0.0  
**Base URL**: `https://your-app.pages.dev` (production) or `http://localhost:8787` (development)

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Public Endpoints](#public-endpoints)
4. [Admin Endpoints](#admin-endpoints)
5. [Error Handling](#error-handling)
6. [Rate Limiting](#rate-limiting)

## Overview

ChessChatWeb API provides endpoints for:
- Chess move generation with AI
- Post-game chat analysis
- Knowledge Vault management (admin)
- CoachEngine access (admin)
- System health monitoring

### API Design Principles

- **RESTful**: Resource-based URLs with standard HTTP methods
- **JSON**: All requests and responses use JSON format
- **Stateless**: No server-side session state (except admin tokens)
- **Idempotent**: Safe to retry GET/PUT/DELETE operations

### Base Headers

```http
Content-Type: application/json
Accept: application/json
```

## Authentication

### Public Endpoints

No authentication required:
- `/api/chess/*` - Chess game endpoints
- `/api/chat` - Post-game chat
- `/api/health` - Health check

### Admin Endpoints

Require Bearer token in Authorization header:

```http
Authorization: Bearer {token}
```

**Token Acquisition**: See [POST /api/admin/auth/unlock](#post-apiadminauthunlock)

**Token Expiration**: 2 hours from issuance

**Invalid Token Response**:
```json
{
  "error": "Unauthorized",
  "code": "INVALID_TOKEN"
}
```

---

## Public Endpoints

### Chess

#### POST /api/chess/move

Generate an AI move for the current position.

**Request Body**:
```json
{
  "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  "pgn": "1. e4 e5",
  "modelId": "openrouter:openai/gpt-4",
  "gameId": "game-123" // optional, for conversation context
}
```

**Response** (200 OK):
```json
{
  "move": "e2e4",
  "uciFormat": "e2e4",
  "san": "e4",
  "commentary": "Controlling the center with the king's pawn.",
  "conversationId": "conv-456",
  "gameId": "game-123"
}
```

**Error Responses**:
- `400 Bad Request`: Invalid FEN or model ID
- `500 Internal Server Error`: AI API failure

**Example**:
```bash
curl -X POST http://localhost:8787/api/chess/move \
  -H "Content-Type: application/json" \
  -d '{
    "fen": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
    "pgn": "1. e4",
    "modelId": "openrouter:openai/gpt-4"
  }'
```

---

### Chat

#### POST /api/chat

Get AI analysis and coaching for a completed game.

**Request Body**:
```json
{
  "message": "Where did I make mistakes?",
  "gameContext": {
    "finalFEN": "8/8/8/8/8/8/8/K7 w - - 0 50",
    "pgn": "1. e4 e5 2. Nf3 Nc6...",
    "result": "0-1"
  },
  "chatHistory": [
    {
      "id": "msg-1",
      "content": "Previous question",
      "isUser": true,
      "timestamp": 1702900000000
    }
  ],
  "model": "openrouter:openai/gpt-4"
}
```

**Response** (200 OK):
```json
{
  "response": "You had a critical blunder on move 15 when you moved your queen to e5...",
  "model": "openrouter:openai/gpt-4",
  "conversationId": "conv-789"
}
```

**Error Responses**:
- `400 Bad Request`: Missing required fields
- `500 Internal Server Error`: AI API failure

---

### Health

#### GET /api/health

Check system health and database connectivity.

**Response** (200 OK):
```json
{
  "status": "healthy",
  "timestamp": "2025-12-18T10:30:00.000Z",
  "uptime": 3600,
  "database": {
    "dbReady": true,
    "connectionStatus": "connected",
    "responseTime": 15,
    "openConnections": 3,
    "maxConnections": 10
  },
  "environment": "production"
}
```

**Response** (503 Service Unavailable):
```json
{
  "status": "unhealthy",
  "timestamp": "2025-12-18T10:30:00.000Z",
  "database": {
    "dbReady": false,
    "connectionStatus": "disconnected",
    "error": "Connection timeout"
  }
}
```

---

## Admin Endpoints

### Authentication

#### POST /api/admin/auth/unlock

Authenticate as admin and receive session token.

**Request Body**:
```json
{
  "password": "ChessAdmin2025!"
}
```

**Response** (200 OK):
```json
{
  "token": "abc123-def456-ghi789",
  "expiresAt": "2025-12-18T12:30:00.000Z",
  "sessionId": "sess-123"
}
```

**Error Responses**:
- `401 Unauthorized`: Incorrect password
- `429 Too Many Requests`: Rate limit exceeded

---

#### POST /api/admin/auth/logout

Invalidate current admin session.

**Headers**:
```http
Authorization: Bearer {token}
```

**Response** (200 OK):
```json
{
  "message": "Logged out successfully"
}
```

---

### Knowledge Vault

#### GET /api/admin/knowledge/sources

List all knowledge sources.

**Headers**:
```http
Authorization: Bearer {token}
```

**Query Parameters**:
- `includeDeleted` (optional): Include soft-deleted sources (default: false)

**Response** (200 OK):
```json
{
  "sources": [
    {
      "id": "src-1",
      "title": "Chess Tactics",
      "sourceType": "book",
      "url": "https://example.com/tactics",
      "chunkCount": 14,
      "isDeleted": false,
      "createdAt": "2025-12-01T10:00:00.000Z",
      "updatedAt": "2025-12-01T10:00:00.000Z"
    }
  ],
  "count": 1
}
```

---

#### POST /api/admin/knowledge/sources

Create a new knowledge source.

**Headers**:
```http
Authorization: Bearer {token}
```

**Request Body**:
```json
{
  "title": "Endgame Mastery",
  "sourceType": "course",
  "url": "https://example.com/endgame"
}
```

**Response** (201 Created):
```json
{
  "id": "src-2",
  "title": "Endgame Mastery",
  "sourceType": "course",
  "url": "https://example.com/endgame",
  "chunkCount": 0,
  "isDeleted": false,
  "createdAt": "2025-12-18T10:30:00.000Z",
  "updatedAt": "2025-12-18T10:30:00.000Z"
}
```

**Error Responses**:
- `400 Bad Request`: Invalid input (missing title, invalid sourceType)
- `401 Unauthorized`: Invalid/expired token

---

#### GET /api/admin/knowledge/sources/{id}

Get a specific knowledge source.

**Headers**:
```http
Authorization: Bearer {token}
```

**Response** (200 OK):
```json
{
  "id": "src-1",
  "title": "Chess Tactics",
  "sourceType": "book",
  "url": "https://example.com/tactics",
  "chunkCount": 14,
  "isDeleted": false,
  "createdAt": "2025-12-01T10:00:00.000Z",
  "updatedAt": "2025-12-01T10:00:00.000Z"
}
```

**Error Responses**:
- `404 Not Found`: Source does not exist

---

#### PATCH /api/admin/knowledge/sources/{id}

Update a knowledge source.

**Headers**:
```http
Authorization: Bearer {token}
```

**Request Body** (partial update):
```json
{
  "title": "Advanced Tactics",
  "url": "https://example.com/advanced-tactics"
}
```

**Response** (200 OK):
```json
{
  "id": "src-1",
  "title": "Advanced Tactics",
  "sourceType": "book",
  "url": "https://example.com/advanced-tactics",
  "chunkCount": 14,
  "isDeleted": false,
  "createdAt": "2025-12-01T10:00:00.000Z",
  "updatedAt": "2025-12-18T10:30:00.000Z"
}
```

---

#### DELETE /api/admin/knowledge/sources/{id}

Soft-delete a knowledge source (and all its chunks).

**Headers**:
```http
Authorization: Bearer {token}
```

**Response** (200 OK):
```json
{
  "message": "Source deleted successfully",
  "id": "src-1"
}
```

---

#### GET /api/admin/knowledge/sources/{id}/chunks

List all chunks for a specific source.

**Headers**:
```http
Authorization: Bearer {token}
```

**Response** (200 OK):
```json
{
  "chunks": [
    {
      "id": "chunk-1",
      "sourceId": "src-1",
      "chunkText": "## Pin\n\nA pin is a tactical motif...",
      "tags": "[\"tactics\", \"pin\"]",
      "language": "en",
      "createdAt": "2025-12-01T10:00:00.000Z"
    }
  ],
  "count": 14
}
```

---

#### POST /api/admin/knowledge/sources/{id}/chunks

Create a new chunk for a source.

**Headers**:
```http
Authorization: Bearer {token}
```

**Request Body**:
```json
{
  "chunkText": "## Zugzwang\n\nA position where any move worsens the position.",
  "tags": ["endgame", "zugzwang", "advanced"],
  "language": "en"
}
```

**Response** (201 Created):
```json
{
  "id": "chunk-15",
  "sourceId": "src-1",
  "chunkText": "## Zugzwang\n\nA position where any move worsens the position.",
  "tags": "[\"endgame\", \"zugzwang\", \"advanced\"]",
  "language": "en",
  "createdAt": "2025-12-18T10:30:00.000Z"
}
```

**Constraints**:
- `chunkText`: Max 5000 characters
- `tags`: Array, max 20 tags per chunk

---

#### PATCH /api/admin/knowledge/chunks/{chunkId}

Update a specific chunk.

**Headers**:
```http
Authorization: Bearer {token}
```

**Request Body** (partial update):
```json
{
  "chunkText": "## Zugzwang (Updated)\n\nA refined explanation...",
  "tags": ["endgame", "zugzwang", "advanced", "strategy"]
}
```

**Response** (200 OK):
```json
{
  "id": "chunk-15",
  "sourceId": "src-1",
  "chunkText": "## Zugzwang (Updated)\n\nA refined explanation...",
  "tags": "[\"endgame\", \"zugzwang\", \"advanced\", \"strategy\"]",
  "language": "en",
  "createdAt": "2025-12-18T10:30:00.000Z"
}
```

---

#### DELETE /api/admin/knowledge/chunks/{chunkId}

Delete a specific chunk.

**Headers**:
```http
Authorization: Bearer {token}
```

**Response** (200 OK):
```json
{
  "message": "Chunk deleted successfully",
  "id": "chunk-15"
}
```

---

### CoachEngine

#### POST /api/admin/coach

Get coaching insights from CoachEngine.

**Headers**:
```http
Authorization: Bearer {token}
```

**Request Body** (Action: search_knowledge):
```json
{
  "action": "search_knowledge",
  "query": "pin tactics"
}
```

**Response** (200 OK):
```json
{
  "query": "pin tactics",
  "count": 2,
  "results": [
    {
      "id": "chunk-1",
      "text": "A pin is a tactical motif where...",
      "fullText": "## Pin\n\nA pin is...",
      "tags": "[\"tactics\", \"pin\"]",
      "source": "Chess Tactics"
    }
  ]
}
```

**Request Body** (Action: thematic_coaching):
```json
{
  "action": "thematic_coaching",
  "theme": "endgame"
}
```

**Response** (200 OK):
```json
{
  "theme": "Endgame Mastery",
  "coaching": "In the endgame, king activity is paramount...",
  "count": 15,
  "results": [/* chunks */]
}
```

**Request Body** (Action: generate_advice):
```json
{
  "action": "generate_advice",
  "gamePhase": "middlegame",
  "playerColor": "white",
  "skillLevel": "intermediate",
  "themes": "tactics,positional-play",
  "moveCount": 25
}
```

**Response** (200 OK):
```json
{
  "coaching": "Based on your middlegame position, focus on...",
  "relevantKnowledge": ["chunk-1", "chunk-5"],
  "sources": ["Chess Tactics", "Positional Play"],
  "confidence": 0.85
}
```

---

### Audit Log

#### GET /api/admin/audit

Retrieve audit log entries.

**Headers**:
```http
Authorization: Bearer {token}
```

**Query Parameters**:
- `limit` (optional): Max entries to return (default: 100, max: 1000)
- `action` (optional): Filter by action type
- `target` (optional): Filter by target resource

**Response** (200 OK):
```json
{
  "logs": [
    {
      "id": "log-1",
      "action": "DELETE_SOURCE",
      "target": "src-1",
      "details": "{\"title\":\"Chess Tactics\"}",
      "timestamp": "2025-12-18T10:30:00.000Z"
    }
  ],
  "count": 1
}
```

---

## Error Handling

### Standard Error Response

```json
{
  "error": "Resource not found",
  "code": "NOT_FOUND",
  "details": "Source with ID 'xyz' does not exist",
  "timestamp": "2025-12-18T10:30:00.000Z"
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_REQUEST` | 400 | Malformed request body |
| `MISSING_FIELD` | 400 | Required field missing |
| `UNAUTHORIZED` | 401 | Invalid/expired token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource does not exist |
| `CONFLICT` | 409 | Resource already exists |
| `RATE_LIMIT` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |
| `SERVICE_UNAVAILABLE` | 503 | Database/external service down |

---

## Rate Limiting

**Current Status**: Not implemented (future enhancement)

**Planned Limits**:
- Public endpoints: 100 req/min per IP
- Admin endpoints: 1000 req/min per token
- POST /api/admin/auth/unlock: 5 req/min per IP

**Rate Limit Headers** (future):
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1702900000
```

---

**Next**: See [API_AUTHENTICATION.md](./API_AUTHENTICATION.md) for detailed auth flow.
