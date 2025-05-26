# Build stage
FROM mcr.microsoft.com/playwright:v1.43.0-jammy AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the application
COPY . .

# Final stage
FROM mcr.microsoft.com/playwright:v1.43.0-jammy

# Install Firefox and Xvfb
RUN apt-get update && \
    apt-get install -y firefox-esr xvfb && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy built application from builder stage
COPY --from=builder /app .

# Install Firefox browser
RUN npx playwright install firefox

# Create necessary directories
RUN mkdir -p /app/server/images /app/credentials

# Set environment variables
ENV NODE_ENV=production
ENV DISPLAY=:99
ENV PORT=3000

# Create start script
RUN echo '#!/bin/bash\n\
echo "[$(date)] Starting Xvfb..."\n\
Xvfb :99 -screen 0 1024x768x16 &\n\
sleep 1\n\
echo "[$(date)] Starting Node.js application..."\n\
exec node server/server.js' > /app/start.sh && \
    chmod +x /app/start.sh

# Expose the port
EXPOSE 3000

# Start the application
CMD ["/app/start.sh"]
