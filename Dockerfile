FROM node:18-slim

# Install Firefox and dependencies
RUN apt-get update && \
    apt-get install -y \
    firefox-esr \
    xvfb \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Install Playwright Firefox
RUN npx playwright install firefox

# Copy the rest of the application
COPY . .

# Create necessary directories
RUN mkdir -p /app/server/images /app/credentials

# Set environment variables
ENV NODE_ENV=production
ENV DISPLAY=:99
ENV PORT=3000

# Create start script
RUN echo '#!/bin/bash\n\
Xvfb :99 -screen 0 1024x768x16 &\n\
sleep 1\n\
exec node server/server.js' > /app/start.sh && \
    chmod +x /app/start.sh

# Expose the port
EXPOSE 3000

# Start the application
CMD ["/app/start.sh"]
