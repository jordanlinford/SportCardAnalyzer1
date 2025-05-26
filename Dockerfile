FROM mcr.microsoft.com/playwright:v1.43.0-jammy

# Install Firefox and Xvfb
RUN apt-get update && \
    apt-get install -y firefox-esr xvfb && \
    rm -rf /var/lib/apt/lists/* && \
    which firefox-esr > /firefox-path.txt

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies and ensure Firefox is installed
RUN npm install && \
    npx playwright install firefox && \
    npx playwright install-deps firefox

# Copy the rest of the application
COPY . .

# Create necessary directories
RUN mkdir -p /app/server/images /app/credentials

# Set environment variables
ENV NODE_ENV=production
ENV DISPLAY=:99
ENV PORT=10000

# Get Firefox path and create start script
RUN FIREFOX_PATH=$(cat /firefox-path.txt) && \
    echo '#!/bin/bash\n\
Xvfb :99 -screen 0 1024x768x16 &\n\
sleep 1\n\
export FIREFOX_PATH='$FIREFOX_PATH'\n\
echo "Firefox path: $FIREFOX_PATH"\n\
exec node server/server.js' > /app/start.sh && \
    chmod +x /app/start.sh

# Expose the port
EXPOSE 10000

# Start the application
CMD ["/app/start.sh"]
