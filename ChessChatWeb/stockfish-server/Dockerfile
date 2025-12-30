# Stockfish HTTP Server - Docker Configuration
# 
# This Dockerfile builds a production-ready container for the Stockfish HTTP server
# using native Stockfish binary for maximum performance.

FROM node:18-alpine

# Install Stockfish binary
RUN apk add --no-cache stockfish

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY server.js ./

# Expose port
EXPOSE 3001

# Set environment variables
ENV PORT=3001
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); })"

# Run server
CMD ["node", "server.js"]
