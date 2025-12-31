# ChessChatWeb Developer Guide

**Last Updated**: December 18, 2025  
**Version**: 1.0.0

This guide covers development workflows, codebase architecture, and contribution guidelines for ChessChatWeb.

## Table of Contents

1. [Development Setup](#development-setup)
2. [Project Structure](#project-structure)
3. [Key Concepts](#key-concepts)
4. [Development Workflows](#development-workflows)
5. [Testing](#testing)
6. [Code Style](#code-style)
7. [Common Tasks](#common-tasks)
8. [Debugging](#debugging)

## Development Setup

### Prerequisites

- **Node.js**: 18.x or higher
- **npm**: 9.x or higher
- **Git**: For version control
- **VS Code** (recommended): With TypeScript and Prisma extensions

### Initial Setup

```bash
# Clone repository
git clone <repository-url>
cd ChessChatWeb

# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Create .env file
cp .env.example .env
```

### Environment Variables

Create `.env` in project root:

```env
# Database (Cloudflare D1 binding in production, SQLite locally)
DATABASE_URL="file:./dev.db"

# Admin password
ADMIN_PASSWORD="ChessAdmin2025!"

# Node environment
NODE_ENV="development"
```

### Running Locally

**Option 1: Full Stack with Mock Backend**

```bash
# Terminal 1: Start mock backend
npm run dev:mock

# Terminal 2: Start frontend
npm run dev
```

- Frontend: `http://localhost:3000`
- Mock Backend: `http://localhost:8787`

**Option 2: Frontend Only (requires deployed backend)**

```bash
npm run dev
```

## Project Structure

```
ChessChatWeb/
├── src/                        # Frontend source
│   ├── components/             # React components
│   │   ├── GameView.tsx
│   │   ├── PostGameChat.tsx
│   │   ├── CoachingPanel.tsx
│   │   └── admin/              # Admin portal components
│   ├── hooks/                  # Custom React hooks
│   │   └── useCoaching.ts
│   ├── lib/                    # Core libraries
│   │   ├── chess.ts            # Chess.js wrapper
│   │   ├── api.ts              # API client
│   │   └── models.ts           # TypeScript interfaces
│   ├── store/                  # Zustand state stores
│   │   ├── gameStore.ts
│   │   └── adminStore.ts
│   ├── styles/                 # CSS stylesheets
│   ├── App.tsx                 # Root component
│   └── main.tsx                # Entry point
├── functions/                  # Cloudflare Functions (backend)
│   ├── api/                    # API endpoints
│   │   ├── chess/              # Chess move generation
│   │   ├── chat.ts             # Post-game chat
│   │   ├── health.ts           # Health check
│   │   └── admin/              # Admin endpoints
│   └── lib/                    # Backend libraries
│       ├── db.ts               # Prisma client
│       ├── coachEngine.ts      # Coaching logic
│       ├── knowledgeService.ts # Knowledge CRUD
│       └── adminAuthService.ts # Auth service
├── prisma/                     # Database schema
│   ├── schema.prisma
│   └── migrations/
├── scripts/                    # Utility scripts
│   └── import-knowledge.ts     # Knowledge import
├── docs/                       # Documentation
├── dev/                        # Development utilities
│   └── mock-backend.ts         # Express mock server
├── public/                     # Static assets
├── package.json
├── tsconfig.json
└── vite.config.ts
```

### Key Directories

- **`src/`**: All frontend code (React + TypeScript)
- **`functions/`**: Serverless backend (Cloudflare Workers)
- **`prisma/`**: Database schema and migrations
- **`docs/`**: Project documentation

## Key Concepts

### Frontend Architecture

#### State Management (Zustand)

**Game Store** (`src/store/gameStore.ts`):
```typescript
const { chess, gameState, makePlayerMove, goToPostGame } = useGameStore();
```

**Admin Store** (`src/store/adminStore.ts`):
```typescript
const { token, unlock, logout } = useAdminStore();
```

**Why Zustand?**
- Minimal boilerplate
- No context providers needed
- DevTools support
- Persist middleware for session storage

#### API Client Pattern

All API calls go through `src/lib/api.ts`:

```typescript
import { api } from '../lib/api';

const response = await api.chat(request);
```

**Benefits**:
- Centralized error handling
- Retry logic with exponential backoff
- Type-safe requests/responses
- Easy to mock for testing

#### Component Patterns

**Lazy Loading**:
```typescript
const GameView = React.lazy(() => import('./components/GameView'));
```

**Type-Safe Props**:
```typescript
interface CoachingPanelProps {
  gamePhase: 'opening' | 'middlegame' | 'endgame';
  onClose: () => void;
}

export const CoachingPanel: React.FC<CoachingPanelProps> = ({ gamePhase, onClose }) => {
  // ...
};
```

### Backend Architecture

#### Cloudflare Functions

Each file in `functions/api/` becomes an endpoint:

```
functions/api/chess/move.ts → POST /api/chess/move
functions/api/chat.ts → POST /api/chat
functions/api/health.ts → GET /api/health
```

**Function Signature**:
```typescript
export async function onRequestPost(context: PagesFunction) {
  const { request, env } = context;
  const body = await request.json();
  
  // Handle request
  
  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' }
  });
}
```

#### Database Access (Prisma)

```typescript
import { getPrismaClient } from '../lib/db';

const prisma = getPrismaClient(env.DB);
const sources = await prisma.knowledgeSource.findMany();
```

**Why Prisma?**
- Type-safe database queries
- Auto-generated client
- Migration management
- Works with D1 (SQLite)

#### CoachEngine Logic

**Self-Contained Design**:
1. No external AI APIs for coaching
2. Local knowledge base search
3. Deterministic relevance scoring
4. Fast response times (<100ms)

**Algorithm**:
```typescript
function scoreChunk(chunk, query, context) {
  let score = 0;
  score += keywordMatches * 10;
  score += tagMatches * 20;
  score += contextMatches * 15;
  return score;
}
```

## Development Workflows

### Adding a New Component

1. **Create Component File**:
   ```bash
   # src/components/MyComponent.tsx
   ```

2. **Define Props Interface**:
   ```typescript
   interface MyComponentProps {
     title: string;
     onSubmit: (value: string) => void;
   }
   ```

3. **Implement Component**:
   ```typescript
   export const MyComponent: React.FC<MyComponentProps> = ({ title, onSubmit }) => {
     return <div>{title}</div>;
   };
   ```

4. **Create Stylesheet** (optional):
   ```bash
   # src/styles/MyComponent.css
   ```

5. **Import in Parent**:
   ```typescript
   import { MyComponent } from './components/MyComponent';
   ```

### Adding a New API Endpoint

1. **Create Function File**:
   ```bash
   # functions/api/my-endpoint.ts
   ```

2. **Implement Handler**:
   ```typescript
   export async function onRequestPost(context) {
     const { request, env } = context;
     const body = await request.json();
     
     // Validate input
     if (!body.requiredField) {
       return new Response('Missing field', { status: 400 });
     }
     
     // Process request
     const result = { success: true };
     
     return new Response(JSON.stringify(result), {
       headers: { 'Content-Type': 'application/json' }
     });
   }
   ```

3. **Add Type Definitions**:
   ```typescript
   // src/lib/models.ts
   export interface MyRequest {
     requiredField: string;
   }
   
   export interface MyResponse {
     success: boolean;
   }
   ```

4. **Update API Client**:
   ```typescript
   // src/lib/api.ts
   async myEndpoint(request: MyRequest): Promise<MyResponse> {
     return this.request('/api/my-endpoint', {
       method: 'POST',
       body: JSON.stringify(request)
     });
   }
   ```

### Modifying Database Schema

1. **Update Prisma Schema**:
   ```prisma
   // prisma/schema.prisma
   model MyNewTable {
     id        String   @id @default(cuid())
     name      String
     createdAt DateTime @default(now())
   }
   ```

2. **Create Migration**:
   ```bash
   npx prisma migrate dev --name add_my_new_table
   ```

3. **Regenerate Client**:
   ```bash
   npx prisma generate
   ```

4. **Use in Code**:
   ```typescript
   const items = await prisma.myNewTable.findMany();
   ```

### Adding Knowledge Content

1. **Create Markdown File**:
   ```markdown
   <!-- knowledge_seed/my-source.md -->
   # My Chess Source
   
   ## Concept 1
   
   Explanation of concept 1...
   
   **Tags**: concept, beginner
   
   ## Concept 2
   
   Explanation of concept 2...
   
   **Tags**: concept, intermediate
   ```

2. **Run Import Script**:
   ```bash
   npm run import-knowledge
   ```

3. **Verify in Admin Portal**:
   - Navigate to `http://localhost:3000/admin`
   - Check Knowledge Vault tab

## Testing

### Manual Testing

**Frontend**:
```bash
npm run dev
# Open http://localhost:3000
# Test UI interactions
```

**Backend (Mock)**:
```bash
npm run dev:mock
# Test API endpoints with curl/Postman
```

**Example curl test**:
```bash
curl -X POST http://localhost:8787/api/health
```

### Type Checking

```bash
npm run type-check
```

Runs TypeScript compiler in check-only mode. Fix errors before committing.

### Build Test

```bash
npm run build
```

Ensures production build succeeds. Check `dist/` output.

### Integration Testing (Future)

Planned tools:
- **Vitest**: Unit tests for utility functions
- **React Testing Library**: Component tests
- **Playwright**: End-to-end tests

## Code Style

### TypeScript Guidelines

**Prefer Explicit Types**:
```typescript
// ✅ Good
const count: number = 42;
const getName = (): string => 'Alice';

// ❌ Avoid
const count = 42; // Type inference is OK for obvious cases
```

**Use Interfaces for Props**:
```typescript
interface ButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean; // Optional with ?
}
```

**Avoid `any`**:
```typescript
// ❌ Avoid
const data: any = response.json();

// ✅ Better
interface ResponseData {
  id: string;
  name: string;
}
const data: ResponseData = response.json();
```

### React Best Practices

**Functional Components**:
```typescript
// ✅ Preferred
export const MyComponent: React.FC<Props> = ({ prop1 }) => {
  return <div>{prop1}</div>;
};

// ❌ Avoid class components
class MyComponent extends React.Component { ... }
```

**Hooks**:
```typescript
// ✅ useState for local state
const [count, setCount] = useState(0);

// ✅ useEffect for side effects
useEffect(() => {
  fetchData();
}, [dependency]);

// ✅ useCallback for memoized functions
const handleClick = useCallback(() => {
  console.log(value);
}, [value]);
```

**Avoid Prop Drilling**:
```typescript
// ❌ Avoid passing props through many levels
<Parent data={data}>
  <Child data={data}>
    <Grandchild data={data} />
  </Child>
</Parent>

// ✅ Use Zustand store or Context
const { data } = useGameStore();
```

### CSS Conventions

**Component-Specific Styles**:
```css
/* src/styles/MyComponent.css */
.my-component {
  /* Component root */
}

.my-component__header {
  /* Child element (BEM-inspired) */
}

.my-component--active {
  /* Modifier state */
}
```

**CSS Variables**:
```css
:root {
  --primary-color: #4a9eff;
  --text-primary: #f8fafc;
}

.my-component {
  color: var(--text-primary);
}
```

## Common Tasks

### Adding a New AI Model

1. **Update Model Registry** (`src/lib/models.ts`):
   ```typescript
   export class AIModelRegistry {
     static readonly models: AIModel[] = [
       // ...existing models
       {
         id: 'my-new-model',
         name: 'My New Model',
         provider: 'openrouter',
         modelIdentifier: 'provider/model-name',
         tier: 'premium',
         pricePerMove: 0.01,
       },
     ];
   }
   ```

2. **Test in UI**: Settings → AI Model

### Adding New Coaching Themes

1. **Add to Quick Actions** (`src/components/CoachingPanel.tsx`):
   ```typescript
   const quickActions = {
     middlegame: [
       // ...existing
       { label: '🆕 My Theme', query: 'my-theme' },
     ],
   };
   ```

2. **Add Knowledge Chunks**: Create markdown with `my-theme` tags

### Changing Admin Password

**Development**:
```env
# .env
ADMIN_PASSWORD="NewPassword123!"
```

**Production**:
```bash
# Cloudflare dashboard
# Pages → Settings → Environment Variables
ADMIN_PASSWORD = "NewPassword123!"
```

## Debugging

### Frontend Debugging

**Chrome DevTools**:
1. Open DevTools (F12)
2. **Console**: View logs, errors
3. **Network**: Inspect API calls
4. **React DevTools**: Inspect component state

**Logging**:
```typescript
console.log('[GameStore] Making move:', from, to);
console.error('[API] Request failed:', error);
```

### Backend Debugging

**Mock Backend Logs**:
```bash
npm run dev:mock
# Logs appear in terminal
```

**Cloudflare Wrangler (Production)**:
```bash
npx wrangler tail
# Streams live logs from production
```

**Add Debug Logging**:
```typescript
console.log('[CoachEngine] Query:', query);
console.log('[DB] Query result:', results.length, 'chunks');
```

### Common Issues

**"Prisma Client not generated"**:
```bash
npx prisma generate
```

**"Port 8787 already in use"**:
```bash
# Kill existing process
Stop-Process -Name "node" -Force
```

**"TypeScript errors"**:
```bash
npm run type-check
# Fix errors one by one
```

---

**Next Steps**: See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) to deploy to production.
