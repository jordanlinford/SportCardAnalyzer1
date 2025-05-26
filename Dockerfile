FROM mcr.microsoft.com/playwright:v1.43.0-jammy

# Install Firefox and Xvfb
RUN apt-get update && \
    apt-get install -y firefox-esr xvfb && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install && \
    npx playwright install firefox

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

# Start the application
CMD ["/app/start.sh"]
