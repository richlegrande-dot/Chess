# Cloudflare Pages Deployment Automation

Complete automation system for deploying ChessChat Web (React/Vite + TypeScript) to Cloudflare Pages with Functions, KV storage, and Prisma database integration.

## 🚀 Features

- ✅ **Automated Deployment**: Full deployment lifecycle automation
- ✅ **KV Storage**: Automated KV namespace creation and binding
- ✅ **Environment Management**: Secrets and environment variable management
- ✅ **Pre-deploy Validation**: Configuration and dependency checks
- ✅ **Post-deploy Verification**: Health checks and API testing
- ✅ **GitHub Actions CI/CD**: Automated deployment workflows
- ✅ **Troubleshooting Tools**: Diagnostic utilities for common issues
- ✅ **Rollback Procedures**: Safe and easy deployment rollbacks
- ✅ **Comprehensive Documentation**: Complete guides and best practices

## 📋 Prerequisites

- Node.js 16+ and npm
- Git repository
- Cloudflare account with Pages enabled
- Wrangler CLI: `npm install -g wrangler`

## 🎯 Quick Start

### 1. Authenticate with Cloudflare

```bash
wrangler login
```

### 2. Set Environment Variables

```bash
export CLOUDFLARE_ACCOUNT_ID="your-account-id"
export PROJECT_NAME="chesschat-web"
```

### 3. Create Environment Configuration

```bash
./scripts/env/manage-env.sh template
# Edit .env.production with your values
```

### 4. Set Up KV Namespaces

```bash
./scripts/kv/setup-kv.sh
```

### 5. Deploy

```bash
./scripts/deploy/deploy.sh
```

That's it! Your application is now deployed to Cloudflare Pages. 🎉

## 📁 Project Structure

```
.
├── .github/
│   └── workflows/
│       └── deploy-cloudflare-pages.yml    # CI/CD workflow
├── scripts/
│   ├── deploy/
│   │   └── deploy.sh                      # Main deployment script
│   ├── kv/
│   │   └── setup-kv.sh                    # KV namespace automation
│   ├── env/
│   │   └── manage-env.sh                  # Environment management
│   ├── validate/
│   │   └── pre-deploy.sh                  # Pre-deploy validation
│   ├── verify/
│   │   └── post-deploy.sh                 # Post-deploy verification
│   ├── troubleshoot/
│   │   └── troubleshoot.sh                # Troubleshooting utility
│   └── rollback/
│       └── rollback.sh                    # Rollback procedures
├── docs/
│   ├── DEPLOYMENT.md                      # Complete deployment guide
│   ├── PAGES_FUNCTIONS.md                 # Pages Functions guide
│   ├── FILE_ROUTING.md                    # File-based routing guide
│   └── DASHBOARD_SETUP.md                 # Dashboard configuration guide
└── README.md                              # This file
```

## 🔧 Available Scripts

### Deployment

```bash
# Deploy to production
./scripts/deploy/deploy.sh

# Deploy to preview environment
ENVIRONMENT=preview ./scripts/deploy/deploy.sh
```

### KV Namespace Management

```bash
# Set up all KV namespaces
./scripts/kv/setup-kv.sh
```

### Environment Management

```bash
# Create environment template
./scripts/env/manage-env.sh template

# Sync environment variables
./scripts/env/manage-env.sh sync .env.production

# List secrets
./scripts/env/manage-env.sh list

# Set a secret
./scripts/env/manage-env.sh set DATABASE_URL "postgresql://..."

# Delete a secret
./scripts/env/manage-env.sh delete OLD_SECRET
```

### Validation & Verification

```bash
# Run pre-deploy validation
./scripts/validate/pre-deploy.sh

# Run post-deploy verification
DEPLOYMENT_URL="https://chesschat-web.pages.dev" ./scripts/verify/post-deploy.sh
```

### Troubleshooting

```bash
# Interactive troubleshooting menu
./scripts/troubleshoot/troubleshoot.sh

# Check specific issues
./scripts/troubleshoot/troubleshoot.sh status
./scripts/troubleshoot/troubleshoot.sh kv
./scripts/troubleshoot/troubleshoot.sh database
```

### Rollback

```bash
# List recent deployments
./scripts/rollback/rollback.sh list

# View deployment history
./scripts/rollback/rollback.sh history

# Rollback to specific commit
./scripts/rollback/rollback.sh git-rollback <commit-sha>
```

## 🤖 GitHub Actions CI/CD

The repository includes a complete CI/CD workflow that automatically deploys your application.

### Workflow Triggers

- **Push to `main`**: Deploy to production
- **Push to `develop`**: Deploy to development environment
- **Pull Request**: Deploy preview environment with comment
- **Manual dispatch**: Deploy to specified environment

### Required Secrets

Add these secrets to your GitHub repository (Settings → Secrets and variables → Actions):

- `CLOUDFLARE_API_TOKEN`: Your Cloudflare API token
- `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare account ID

### Getting Your Credentials

1. **Account ID**: 
   - Go to https://dash.cloudflare.com/
   - Copy from the right sidebar

2. **API Token**:
   - Go to https://dash.cloudflare.com/profile/api-tokens
   - Click "Create Token"
   - Use "Edit Cloudflare Workers" template
   - Add "Account.Cloudflare Pages" permissions

## 📚 Documentation

Comprehensive documentation is available in the `docs/` directory:

- **[DEPLOYMENT.md](docs/DEPLOYMENT.md)**: Complete deployment guide
  - Architecture overview
  - Setup instructions
  - Script usage
  - Best practices

- **[PAGES_FUNCTIONS.md](docs/PAGES_FUNCTIONS.md)**: Pages Functions guide
  - File-based routing
  - Function handlers
  - Context API
  - Middleware
  - TypeScript support
  - KV storage integration

- **[FILE_ROUTING.md](docs/FILE_ROUTING.md)**: File routing guide
  - Routing rules
  - Dynamic routes
  - Catch-all routes
  - Route priority
  - Advanced patterns

- **[DASHBOARD_SETUP.md](docs/DASHBOARD_SETUP.md)**: Dashboard configuration
  - Creating projects
  - Build configuration
  - Environment variables
  - KV namespace bindings
  - Custom domains
  - Analytics

## 🏗️ Architecture

### Deployment Flow

```
┌─────────────────────────────────────────────────┐
│              Deployment Process                 │
├─────────────────────────────────────────────────┤
│                                                 │
│  1. Pre-deploy Validation                      │
│     ├─ Check dependencies                      │
│     ├─ Validate configuration                  │
│     └─ Verify authentication                   │
│                                                 │
│  2. Build Application                          │
│     ├─ Install dependencies (npm ci)           │
│     ├─ Run build (npm run build)               │
│     └─ Generate dist/ directory                │
│                                                 │
│  3. Deploy to Cloudflare Pages                 │
│     ├─ Upload build to Pages                   │
│     ├─ Deploy Functions                        │
│     └─ Bind KV namespaces                      │
│                                                 │
│  4. Post-deploy Verification                   │
│     ├─ Health checks                           │
│     ├─ API testing                             │
│     └─ Performance checks                      │
│                                                 │
│  5. Save Deployment History                    │
│     └─ Record deployment metadata              │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Cloudflare Pages Architecture

```
┌─────────────────────────────────────────────────┐
│           Cloudflare Pages Project              │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌──────────────┐      ┌──────────────┐       │
│  │   Static     │      │    Pages     │       │
│  │   Assets     │      │  Functions   │       │
│  │  (React UI)  │      │  (Backend)   │       │
│  └──────────────┘      └──────────────┘       │
│         │                      │               │
│         └──────────┬───────────┘               │
│                    │                           │
│         ┌──────────▼──────────┐                │
│         │   KV Namespaces     │                │
│         │ - Cache             │                │
│         │ - Sessions          │                │
│         │ - Game State        │                │
│         └─────────────────────┘                │
│                    │                           │
│         ┌──────────▼──────────┐                │
│         │  Prisma Database    │                │
│         │  (PostgreSQL)       │                │
│         └─────────────────────┘                │
└─────────────────────────────────────────────────┘
```

## 🔐 Security

### Environment Variables

- Never commit `.env` files to the repository
- Use Cloudflare secrets for sensitive data
- Rotate API tokens regularly

### Example `.gitignore`

```
.env
.env.*
!.env.example
.deployment-history.json
dist/
node_modules/
```

## 🐛 Troubleshooting

### Common Issues

#### Build Failures

```bash
# Check Node.js version
node --version

# Run build locally
npm run build

# Check build logs
./scripts/troubleshoot/troubleshoot.sh build-logs
```

#### Database Connection Issues

```bash
# Diagnose database issues
./scripts/troubleshoot/troubleshoot.sh database

# Verify DATABASE_URL is set
./scripts/env/manage-env.sh list
```

#### KV Binding Issues

```bash
# Check KV configuration
./scripts/troubleshoot/troubleshoot.sh kv

# Recreate KV namespaces
./scripts/kv/setup-kv.sh
```

### Getting Help

Run the interactive troubleshooting utility:

```bash
./scripts/troubleshoot/troubleshoot.sh
```

## 🔄 Rollback Procedures

### Quick Rollback via Dashboard

1. Go to Cloudflare Dashboard
2. Navigate to Workers & Pages → Your Project
3. Find the deployment to rollback to
4. Click "Rollback to this deployment"

### Rollback via Script

```bash
# List recent deployments
./scripts/rollback/rollback.sh list

# Rollback to specific commit
./scripts/rollback/rollback.sh git-rollback <commit-sha>
```

## 🎨 Best Practices

### Development Workflow

1. **Develop locally** with `npm run dev`
2. **Test build** with `npm run build`
3. **Create PR** to trigger preview deployment
4. **Review preview** deployment
5. **Merge to main** to deploy to production

### Deployment Workflow

1. **Validate locally** before pushing
2. **Use preview deployments** for testing
3. **Monitor deployment logs**
4. **Run post-deploy verification**
5. **Have rollback plan ready**

### Security Best Practices

- ✅ Use encrypted secrets for sensitive data
- ✅ Never expose secrets in client code
- ✅ Rotate API tokens regularly
- ✅ Use environment-specific configurations
- ✅ Enable HTTPS for all connections

## 📊 Monitoring

### Cloudflare Analytics

View analytics in the dashboard:
- **Requests**: Total requests and rate
- **Bandwidth**: Data transfer
- **Status codes**: Success and error rates
- **Performance**: Response times

### Deployment History

Track deployments locally:

```bash
# View deployment history
./scripts/rollback/rollback.sh history

# Check .deployment-history.json
cat .deployment-history.json | jq
```

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🔗 Resources

### Official Documentation

- [Cloudflare Pages](https://developers.cloudflare.com/pages/)
- [Pages Functions](https://developers.cloudflare.com/pages/functions/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
- [KV Storage](https://developers.cloudflare.com/kv/)

### Community

- [Cloudflare Community](https://community.cloudflare.com/)
- [Cloudflare Discord](https://discord.gg/cloudflaredev)
- [GitHub Discussions](https://github.com/cloudflare/pages-discussions)

### Related Projects

- [React](https://react.dev/)
- [Vite](https://vitejs.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Prisma](https://www.prisma.io/)

## 💬 Support

Need help? Here are your options:

1. 📖 Read the [documentation](docs/DEPLOYMENT.md)
2. 🔧 Run `./scripts/troubleshoot/troubleshoot.sh`
3. 💬 Check [Cloudflare Community](https://community.cloudflare.com/)
4. 🐛 Open an [issue](https://github.com/your-repo/issues)

---

**Made with ❤️ for ChessChat Web**
