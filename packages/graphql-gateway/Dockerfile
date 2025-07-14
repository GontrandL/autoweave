# Multi-stage build for GraphQL Gateway
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./
COPY tsup.config.ts ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/
COPY subgraphs/ ./subgraphs/

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Add non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S autoweave -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application
COPY --from=builder --chown=autoweave:nodejs /app/dist ./dist
COPY --from=builder --chown=autoweave:nodejs /app/subgraphs ./subgraphs

# Create necessary directories
RUN mkdir -p /app/logs && chown -R autoweave:nodejs /app/logs

# Switch to non-root user
USER autoweave

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/health || exit 1

# Set environment variables
ENV NODE_ENV=production
ENV PORT=4000

# Start the application
CMD ["npm", "start"]