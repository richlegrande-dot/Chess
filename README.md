# Chess Application

A modern Chess application deployed on Cloudflare Pages with comprehensive deployment infrastructure.

## 🚀 Features

- **Cloudflare Pages Functions** - Serverless API endpoints with file-based routing
- **KV Namespaces** - Analytics and rate limiting storage
- **Health Check API** - Monitor deployment status and system health
- **GitHub Actions** - Automated preview and production deployments
- **Pre/Post Deploy Validation** - Automated validation before and after deployments
- **Rollback Support** - Quick rollback to previous deployments
- **Secret Management** - Secure handling of API keys and credentials

## 📋 Quick Start

### Prerequisites

- Node.js 18+
- Cloudflare account with Pages enabled
- GitHub account

### Installation

```bash
# Clone the repository
git clone https://github.com/richlegrande-dot/Chess.git
cd Chess

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your Cloudflare credentials
```

### Setup KV Namespaces

```bash
npm run setup:kv
```

This creates and binds the required KV namespaces:
- `ANALYTICS_KV` - For analytics and tracking
- `RATE_LIMIT_KV` - For rate limiting

### Configure Secrets

```bash
npm run setup:secrets setup production
```

Required secrets:
- `OPENAI_API_KEY` - OpenAI API key
- `DATABASE_URL` - Database connection string
- `ADMIN_PASSWORD` - Admin dashboard password

### Deploy

```bash
# Deploy to preview
npm run deploy:preview

# Deploy to production
npm run deploy:production
```

## 🛠️ Development

### Local Development

```bash
npm run dev
```

Access the application at `http://localhost:8788`

### Project Structure

```
Chess/
├── functions/           # Cloudflare Pages Functions
│   └── api/
│       └── health.js   # Health check endpoint
├── scripts/            # Deployment and management scripts
│   ├── setup-kv-namespaces.js
│   ├── setup-secrets.js
│   ├── validate-pre-deploy.js
│   ├── validate-post-deploy.js
│   └── rollback.js
├── docs/               # Documentation
│   ├── SETUP.md
│   ├── PAGES_FUNCTIONS_ROUTING.md
│   └── DASHBOARD_CONFIGURATION.md
├── .github/
│   └── workflows/      # GitHub Actions workflows
├── public/             # Static files
├── wrangler.toml       # Cloudflare configuration
└── package.json
```

## 📚 Documentation

- **[Complete Setup Guide](docs/SETUP.md)** - Comprehensive setup instructions
- **[Pages Functions Routing](docs/PAGES_FUNCTIONS_ROUTING.md)** - File-based routing guide
- **[Dashboard Configuration](docs/DASHBOARD_CONFIGURATION.md)** - Cloudflare Dashboard setup

## 🔧 Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start local development server |
| `npm run build` | Build the application |
| `npm run deploy` | Deploy to Cloudflare Pages |
| `npm run deploy:preview` | Deploy to preview environment |
| `npm run deploy:production` | Deploy to production environment |
| `npm run setup:kv` | Create and bind KV namespaces |
| `npm run setup:secrets` | Configure secrets |
| `npm run validate:pre-deploy` | Validate configuration before deployment |
| `npm run validate:post-deploy` | Validate deployment health |
| `npm run rollback` | Rollback to previous deployment |

## 🔍 API Endpoints

### Health Check

**Endpoint:** `GET /api/health`

Returns the health status of the application and its dependencies.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "environment": "production",
  "checks": {
    "analytics_kv": {
      "status": "healthy",
      "message": "Analytics KV namespace is accessible"
    },
    "rate_limit_kv": {
      "status": "healthy",
      "message": "Rate limit KV namespace is accessible"
    },
    "secrets": {
      "status": "healthy",
      "message": "All required secrets are configured"
    }
  }
}
```

## 🔐 Environment Variables

### Build-time Variables

Set in `.env` file for local development:

```bash
CLOUDFLARE_API_TOKEN=your_token
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_PROJECT_NAME=chess
```

### Runtime Variables (Secrets)

Configured via Cloudflare Dashboard or CLI:

- `OPENAI_API_KEY` - OpenAI API key
- `DATABASE_URL` - Database connection string
- `ADMIN_PASSWORD` - Admin password
- `ENVIRONMENT` - Current environment (production/preview)

## 🚦 CI/CD

### GitHub Actions Workflows

**Preview Deployment** (`.github/workflows/deploy-preview.yml`)
- Triggers on pull requests and non-main branches
- Deploys to preview environment
- Comments deployment URL on PRs

**Production Deployment** (`.github/workflows/deploy-production.yml`)
- Triggers on push to `main` branch
- Deploys to production environment
- Includes pre/post deployment validation

### Required GitHub Secrets

Add these secrets to your GitHub repository:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_PROJECT_NAME`

## 🔄 Rollback

### List Recent Deployments

```bash
npm run rollback list
```

### Rollback to Previous Deployment

```bash
npm run rollback latest
```

### Rollback to Specific Deployment

```bash
npm run rollback <deployment-id>
```

## 🧪 Validation

### Pre-Deploy Validation

Validates before deployment:
- ✓ wrangler.toml configuration
- ✓ Environment variables
- ✓ KV namespaces
- ✓ Secrets configuration
- ✓ Database connection

```bash
npm run validate:pre-deploy
```

### Post-Deploy Validation

Validates after deployment:
- ✓ Health check endpoint
- ✓ KV namespace functionality
- ✓ Secrets accessibility
- ✓ Application responsiveness

```bash
npm run validate:post-deploy https://chess.pages.dev
```

## 🐛 Troubleshooting

### KV Namespace Issues

```bash
# Recreate KV namespaces
npm run setup:kv
```

### Secret Issues

```bash
# Verify secrets are configured
npm run setup:secrets verify production

# Reconfigure secrets
npm run setup:secrets setup production
```

### Deployment Failures

1. Check pre-deploy validation: `npm run validate:pre-deploy`
2. Review deployment logs in Cloudflare Dashboard
3. Check GitHub Actions logs
4. Rollback if necessary: `npm run rollback latest`

## 📝 License

ISC

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📞 Support

For issues and questions:
- Open an issue on GitHub
- Check the [documentation](docs/)
- Review [Cloudflare Pages documentation](https://developers.cloudflare.com/pages/)

## 🌟 Acknowledgments

- Built with [Cloudflare Pages](https://pages.cloudflare.com/)
- Deployed using [Wrangler](https://developers.cloudflare.com/workers/wrangler/)
- CI/CD powered by [GitHub Actions](https://github.com/features/actions)