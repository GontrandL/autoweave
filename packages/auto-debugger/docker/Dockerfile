# syntax=docker/dockerfile:1
FROM mcr.microsoft.com/playwright:v1.40.0-noble

# Create non-root user for security
RUN groupadd -r pwgroup && useradd -r -g pwgroup -G audio,video pwuser \
    && mkdir -p /home/pwuser/Downloads \
    && chown -R pwuser:pwgroup /home/pwuser

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
COPY tsconfig.json ./
COPY tsup.config.ts ./

# Install dependencies as root
RUN npm ci --only=production

# Install Playwright browsers with dependencies
RUN npx playwright install --with-deps chromium firefox webkit

# Copy source files
COPY --chown=pwuser:pwgroup src ./src
COPY --chown=pwuser:pwgroup docker ./docker
COPY --chown=pwuser:pwgroup scripts ./scripts
COPY --chown=pwuser:pwgroup prompts ./prompts

# Build the application
RUN npm run build

# Environment variables
ENV PWDEBUG=0
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV DISPLAY=:99
ENV NODE_ENV=production
ENV MCP_PORT=8931

# Expose MCP server port
EXPOSE 8931

# Switch to non-root user
USER pwuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8931/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start the MCP server
CMD ["node", "dist/index.js"]