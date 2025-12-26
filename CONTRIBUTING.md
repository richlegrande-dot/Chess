# Contributing to Chess

Thank you for considering contributing to the Chess application! This document provides guidelines and instructions for contributing.

## Getting Started

### Prerequisites

- Node.js 18+
- Git
- Cloudflare account
- GitHub account

### Setup Development Environment

1. **Fork the repository**
   ```bash
   # Click "Fork" on GitHub
   ```

2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/Chess.git
   cd Chess
   ```

3. **Add upstream remote**
   ```bash
   git remote add upstream https://github.com/richlegrande-dot/Chess.git
   ```

4. **Install dependencies**
   ```bash
   npm install
   ```

5. **Create .env file**
   ```bash
   cp .env.example .env
   # Edit .env with your Cloudflare credentials
   ```

6. **Run local development server**
   ```bash
   npm run dev
   ```

## Development Workflow

### Creating a Feature Branch

```bash
# Update your local main branch
git checkout main
git pull upstream main

# Create feature branch
git checkout -b feature/your-feature-name
```

### Making Changes

1. **Write code** following our coding standards
2. **Test locally** using `npm run dev`
3. **Validate** using `npm run validate:pre-deploy`
4. **Commit changes** with clear messages

### Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
type(scope): description

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```bash
git commit -m "feat(api): add new chess move endpoint"
git commit -m "fix(health): correct KV namespace check"
git commit -m "docs: update setup guide with new steps"
```

### Pushing Changes

```bash
# Push to your fork
git push origin feature/your-feature-name
```

### Creating a Pull Request

1. Go to your fork on GitHub
2. Click "New Pull Request"
3. Select base: `main` and compare: `feature/your-feature-name`
4. Fill in the PR template:
   - **Title**: Clear, descriptive title
   - **Description**: What changes were made and why
   - **Related Issues**: Link any related issues
   - **Testing**: How you tested the changes
   - **Screenshots**: If applicable

## Coding Standards

### JavaScript/Node.js

- Use **ES6+** features
- Use **async/await** for asynchronous code
- Use **const** for variables that don't change
- Use **let** for variables that change
- Use **template literals** for string interpolation
- Add **JSDoc comments** for functions
- Handle **errors** properly with try-catch

**Example:**
```javascript
/**
 * Creates a new KV namespace
 * @param {string} title - The namespace title
 * @returns {Promise<string>} The namespace ID
 */
async function createKVNamespace(title) {
  try {
    const response = await makeRequest(options, { title });
    return response.result.id;
  } catch (error) {
    console.error(`Failed to create namespace: ${error.message}`);
    throw error;
  }
}
```

### Functions (Cloudflare Pages)

- Export functions for HTTP methods: `onRequestGet`, `onRequestPost`, etc.
- Use **context object** for request, env, params
- Return **Response** objects
- Set appropriate **headers**
- Include **error handling**

**Example:**
```javascript
export async function onRequestGet(context) {
  const { env, request } = context;
  
  try {
    const data = await fetchData(env);
    
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
```

### Documentation

- Update **README.md** for significant changes
- Add/update **docs/** for new features
- Include **code comments** for complex logic
- Update **QUICK_REFERENCE.md** for new commands
- Add **examples** where helpful

### Scripts

- Include **descriptive headers**
- Add **usage instructions**
- Validate **environment variables**
- Provide **clear error messages**
- Add **success confirmations**

## Testing

### Manual Testing

1. **Run locally**
   ```bash
   npm run dev
   ```

2. **Test endpoints**
   ```bash
   curl http://localhost:8788/api/health
   ```

3. **Validate configuration**
   ```bash
   npm run validate:pre-deploy
   ```

### Testing Scripts

Test scripts before committing:

```bash
# Validate syntax
node --check scripts/your-script.js

# Run script in dry-run mode if available
node scripts/your-script.js --dry-run
```

## Pull Request Process

1. **Update documentation** if needed
2. **Test your changes** thoroughly
3. **Validate** with pre-deploy script
4. **Create PR** with clear description
5. **Address review feedback** promptly
6. **Keep PR focused** on one feature/fix

### PR Checklist

Before submitting, ensure:
- [ ] Code follows project standards
- [ ] Changes are tested locally
- [ ] Documentation is updated
- [ ] Commit messages are clear
- [ ] No merge conflicts with main
- [ ] Pre-deploy validation passes
- [ ] PR description is complete

## Issue Reporting

### Bug Reports

Include:
- **Description**: Clear description of the bug
- **Steps to reproduce**: How to reproduce the issue
- **Expected behavior**: What should happen
- **Actual behavior**: What actually happens
- **Environment**: OS, Node version, etc.
- **Logs**: Any relevant error messages

### Feature Requests

Include:
- **Description**: Clear description of the feature
- **Use case**: Why this feature is needed
- **Proposed solution**: How you think it should work
- **Alternatives**: Any alternative solutions considered

## Code Review

### For Reviewers

- Be **constructive** and **respectful**
- Provide **specific feedback**
- Suggest **improvements** when possible
- Approve when ready or request changes

### For Contributors

- Respond to feedback **promptly**
- Be **open** to suggestions
- Ask for **clarification** if needed
- Update PR based on feedback

## Release Process

Releases are handled by maintainers:

1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Create release tag
4. Deploy to production
5. Create GitHub release

## Questions?

- Check [documentation](docs/)
- Open an issue for questions
- Join community discussions

## Code of Conduct

- Be **respectful** and **inclusive**
- Welcome **newcomers**
- Focus on **constructive feedback**
- Help **others** when possible

## License

By contributing, you agree that your contributions will be licensed under the same license as the project (ISC).

## Thank You!

Your contributions help make this project better for everyone. We appreciate your time and effort!
