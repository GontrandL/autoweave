# AutoWeave Production Dockerfile
# Multi-stage build for optimized production deployment

FROM node:18-alpine AS base
LABEL maintainer="AutoWeave Team"
LABEL version="1.0.0"
LABEL description="AutoWeave - The Self-Weaving Agent Orchestrator"

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    py3-pip \
    git \
    curl \
    bash \
    && ln -sf python3 /usr/bin/python

# Create app user for security
RUN addgroup -g 1001 -S autoweave && \
    adduser -S autoweave -u 1001 -G autoweave

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY requirements.txt ./

# Install Node.js dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Install Python dependencies
RUN pip3 install --no-cache-dir -r requirements.txt

# Build stage for production optimizations
FROM base AS builder

# Copy source code
COPY . .

# Run any build steps if needed
RUN npm run build 2>/dev/null || echo "No build script found"

# Production stage
FROM node:18-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache \
    python3 \
    py3-pip \
    curl \
    bash \
    tini

# Create app user
RUN addgroup -g 1001 -S autoweave && \
    adduser -S autoweave -u 1001 -G autoweave

# Set working directory
WORKDIR /app

# Copy package files and install production dependencies
COPY package*.json ./
COPY requirements.txt ./

RUN npm ci --only=production && \
    npm cache clean --force && \
    pip3 install --no-cache-dir -r requirements.txt

# Copy application code from builder
COPY --from=builder --chown=autoweave:autoweave /app/src ./src
COPY --from=builder --chown=autoweave:autoweave /app/scripts ./scripts
COPY --from=builder --chown=autoweave:autoweave /app/k8s ./k8s
COPY --from=builder --chown=autoweave:autoweave /app/docs ./docs
COPY --from=builder --chown=autoweave:autoweave /app/.env.example ./.env.example

# Create necessary directories
RUN mkdir -p /app/logs /app/data && \
    chown -R autoweave:autoweave /app

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Switch to non-root user
USER autoweave

# Expose ports
EXPOSE 3000 3002 8083

# Use tini as init system
ENTRYPOINT ["/sbin/tini", "--"]

# Start application
CMD ["node", "src/index.js"]

# Metadata
LABEL org.opencontainers.image.title="AutoWeave"
LABEL org.opencontainers.image.description="The Self-Weaving Agent Orchestrator with AI Intelligence"
LABEL org.opencontainers.image.url="https://github.com/autoweave/autoweave"
LABEL org.opencontainers.image.documentation="https://docs.autoweave.ai"
LABEL org.opencontainers.image.source="https://github.com/autoweave/autoweave"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.created="2025-07-10T22:00:00Z"
LABEL org.opencontainers.image.licenses="MIT"