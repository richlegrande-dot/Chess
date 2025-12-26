# Chess Application Architecture

This document describes the architecture of the Chess application deployment infrastructure.

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         GitHub Repository                         │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Source Code                                                │ │
│  │  - functions/      (Cloudflare Pages Functions)            │ │
│  │  - scripts/        (Deployment scripts)                     │ │
│  │  - public/         (Static files)                           │ │
│  │  - docs/           (Documentation)                          │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ git push / PR
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       GitHub Actions CI/CD                        │
│  ┌────────────────────┐         ┌──────────────────────────┐   │
│  │  Preview Deploy     │         │  Production Deploy        │   │
│  │  - On PR/branches  │         │  - On main branch push   │   │
│  │  - Pre-validation  │         │  - Pre-validation        │   │
│  │  - Deploy          │         │  - Deploy                │   │
│  │  - Post-validation │         │  - Post-validation       │   │
│  └────────────────────┘         └──────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ wrangler deploy
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Cloudflare Pages                             │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    Static Assets (public/)                  │ │
│  │  - index.html                                               │ │
│  │  - CSS, JS, images                                          │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                    │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              Cloudflare Pages Functions                     │ │
│  │  ┌──────────────────────────────────────────────────────┐  │ │
│  │  │  /api/health                                          │  │ │
│  │  │  - Health check endpoint                              │  │ │
│  │  │  - KV namespace validation                            │  │ │
│  │  │  - Secret validation                                  │  │ │
│  │  └──────────────────────────────────────────────────────┘  │ │
│  │  ┌──────────────────────────────────────────────────────┐  │ │
│  │  │  Environment Variables (env)                          │  │ │
│  │  │  - OPENAI_API_KEY                                     │  │ │
│  │  │  - DATABASE_URL                                       │  │ │
│  │  │  - ADMIN_PASSWORD                                     │  │ │
│  │  │  - ENVIRONMENT                                        │  │ │
│  │  └──────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ bindings
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Cloudflare KV Namespaces                       │
│  ┌──────────────────────┐      ┌──────────────────────────┐     │
│  │   ANALYTICS_KV       │      │   RATE_LIMIT_KV          │     │
│  │  - Page views        │      │  - Request counts        │     │
│  │  - User analytics    │      │  - Rate limits           │     │
│  │  - Event tracking    │      │  - IP-based limits       │     │
│  └──────────────────────┘      └──────────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ connection
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     External Database                             │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  PostgreSQL (via DATABASE_URL)                             │ │
│  │  - User data                                                │ │
│  │  - Game state                                               │ │
│  │  - Analytics                                                │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. GitHub Repository
- **Source code** for the application
- **Scripts** for deployment automation
- **Documentation** for setup and usage
- **GitHub Actions** workflows for CI/CD

### 2. GitHub Actions
- **Preview deployments**: Triggered on pull requests and non-main branches
- **Production deployments**: Triggered on main branch pushes
- **Pre-deploy validation**: Validates configuration before deployment
- **Post-deploy validation**: Validates deployment health after deployment

### 3. Cloudflare Pages
- **Static hosting**: Serves static files from `public/` directory
- **Pages Functions**: Serverless functions with file-based routing
- **Environment variables**: Secure storage for secrets and configuration
- **KV bindings**: Access to KV namespaces for storage

### 4. KV Namespaces
- **ANALYTICS_KV**: Stores analytics data, page views, events
- **RATE_LIMIT_KV**: Stores rate limit counters and IP restrictions

### 5. Database
- **PostgreSQL**: Primary database for persistent data
- **Prisma**: ORM for database access
- **Connection**: Via DATABASE_URL environment variable

## Data Flow

### Request Flow

```
User Request
    │
    ▼
Cloudflare Edge (CDN)
    │
    ├─── Static files? ──> Serve from cache
    │
    └─── API request (/api/*)
         │
         ▼
    Pages Function
         │
         ├─── Check rate limit (RATE_LIMIT_KV)
         │
         ├─── Process request
         │    │
         │    ├─── Access secrets (env.*)
         │    ├─── Query database (DATABASE_URL)
         │    └─── Update analytics (ANALYTICS_KV)
         │
         └─── Return response
              │
              ▼
         User receives response
```

### Deployment Flow

```
Developer
    │
    └─── git push / PR
         │
         ▼
    GitHub Actions
         │
         ├─── Pre-deploy validation
         │    ├─── Check wrangler.toml
         │    ├─── Verify KV namespaces
         │    ├─── Validate secrets
         │    └─── Test database connection
         │
         ├─── Build application
         │    └─── npm run build
         │
         ├─── Deploy to Cloudflare
         │    └─── wrangler pages deploy
         │
         └─── Post-deploy validation
              ├─── Check health endpoint
              ├─── Verify KV access
              └─── Validate secrets
              │
              ▼
         Deployment complete
```

## Security Layers

### 1. Authentication & Authorization
- Admin password stored as encrypted secret
- API key authentication for external services
- Cloudflare Access for preview deployments

### 2. Rate Limiting
- IP-based rate limiting using RATE_LIMIT_KV
- Request throttling at edge
- Per-endpoint rate limits

### 3. Secret Management
- Encrypted storage in Cloudflare
- Never exposed in code or logs
- Separate secrets for production and preview

### 4. Network Security
- HTTPS enforced
- Cloudflare DDoS protection
- Edge-based security rules

## Monitoring & Observability

### Health Checks
```
/api/health
    ├─── System status
    ├─── KV namespace health
    ├─── Secret configuration
    └─── Database connectivity
```

### Logging
- Console logs in Pages Functions
- Cloudflare Analytics
- Real-time log tailing with Wrangler

### Metrics
- Request count and rate
- Response times
- Error rates
- KV operations

## Deployment Environments

### Preview Environment
- **URL**: `https://preview.chess.pages.dev` or `https://<branch>.chess.pages.dev`
- **Trigger**: Pull requests, non-main branches
- **Purpose**: Testing, staging
- **KV**: Separate preview namespaces
- **Secrets**: Preview-specific secrets

### Production Environment
- **URL**: `https://chess.pages.dev`
- **Trigger**: Main branch pushes
- **Purpose**: Live application
- **KV**: Production namespaces
- **Secrets**: Production secrets

## Scaling Considerations

### Cloudflare Pages
- **Global CDN**: Content served from edge locations worldwide
- **Automatic scaling**: Scales automatically based on traffic
- **No cold starts**: Functions are optimized for low latency

### KV Namespaces
- **Global replication**: Data replicated across Cloudflare's network
- **Eventual consistency**: Read-optimized with eventual consistency
- **Rate limits**: 1000 writes/sec, unlimited reads

### Database
- **Connection pooling**: Managed via Prisma
- **Read replicas**: Can be configured for scaling reads
- **Monitoring**: Database-specific monitoring tools

## Backup & Recovery

### Rollback Mechanism
```
npm run rollback list
    └─── Shows recent deployments

npm run rollback latest
    └─── Rolls back to previous deployment

npm run rollback <deployment-id>
    └─── Rolls back to specific deployment
```

### Data Backup
- **KV Namespaces**: Manual backup via API
- **Database**: Database-specific backup solutions
- **Code**: Version controlled in Git

## Local Development

```
Developer Machine
    │
    ├─── npm run dev
    │    └─── wrangler pages dev
    │         │
    │         ├─── Local KV simulation
    │         ├─── Local secrets (.dev.vars)
    │         └─── Hot reload
    │
    └─── Access at http://localhost:8788
```

## Tools & Scripts

### Management Scripts
- `setup-kv-namespaces.js`: Create and configure KV namespaces
- `setup-secrets.js`: Manage secrets
- `validate-pre-deploy.js`: Pre-deployment checks
- `validate-post-deploy.js`: Post-deployment checks
- `rollback.js`: Deployment rollback

### NPM Scripts
- `npm run dev`: Local development
- `npm run deploy`: Deploy to Cloudflare
- `npm run setup:kv`: Setup KV namespaces
- `npm run setup:secrets`: Setup secrets
- `npm run validate:pre-deploy`: Pre-deploy validation
- `npm run validate:post-deploy`: Post-deploy validation
- `npm run rollback`: Rollback deployment

## Resources

- [Complete Setup Guide](SETUP.md)
- [Pages Functions Routing](PAGES_FUNCTIONS_ROUTING.md)
- [Dashboard Configuration](DASHBOARD_CONFIGURATION.md)
- [Quick Reference](QUICK_REFERENCE.md)
- [Contributing Guide](../CONTRIBUTING.md)
