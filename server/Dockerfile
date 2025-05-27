FROM mcr.microsoft.com/playwright:v1.43.0-jammy

# Set environment variables
ENV NODE_ENV=production \
    DISPLAY=:99 \
    PORT=10000 \
    DEBIAN_FRONTEND=noninteractive

# Install Xvfb and Firefox dependencies
RUN apt-get update && \
    apt-get install -y xvfb firefox-esr && \
    rm -rf /var/lib/apt/lists/* && \
    echo "Firefox version:" && \
    firefox-esr --version

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install --production && \
    npx playwright install firefox && \
    npx playwright install-deps firefox && \
    echo "Verifying Playwright installation:" && \
    ls -la /ms-playwright

# Copy the application
COPY . .

# Create necessary directories and set permissions
RUN mkdir -p images credentials && \
    chmod -R 777 images && \
    chmod +x server.js && \
    echo "Directory structure:" && \
    ls -la

# Create start script
RUN echo '#!/bin/bash\n\
echo "=== Environment ==="\n\
env | grep -E "NODE_ENV|DISPLAY|PORT"\n\
echo "=== Firefox Version ==="\n\
firefox-esr --version\n\
echo "=== Starting Xvfb ==="\n\
Xvfb :99 -screen 0 1024x768x16 &\n\
sleep 2\n\
echo "=== Xvfb Process ==="\n\
ps aux | grep Xvfb\n\
echo "=== Starting Node.js Application ==="\n\
exec node server.js' > start.sh && \
    chmod +x start.sh

# Expose the port
EXPOSE 10000

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:10000/ || exit 1

# Start the application
ENTRYPOINT ["./start.sh"] 