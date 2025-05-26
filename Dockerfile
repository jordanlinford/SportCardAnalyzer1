FROM mcr.microsoft.com/playwright:v1.43.0-jammy

# Set environment variables
ENV NODE_ENV=production \
    DISPLAY=:99 \
    PORT=10000 \
    FIREFOX_BINARY=/usr/bin/firefox-esr \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    DEBIAN_FRONTEND=noninteractive

# Install Firefox and Xvfb
RUN apt-get update && \
    apt-get install -y firefox-esr xvfb curl && \
    rm -rf /var/lib/apt/lists/* && \
    echo "Firefox version:" && \
    firefox-esr --version && \
    echo "Firefox location:" && \
    which firefox-esr && \
    ln -s /usr/bin/firefox-esr /usr/local/bin/firefox

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies and ensure Firefox is installed
RUN npm install --no-optional && \
    npx playwright install firefox && \
    npx playwright install-deps firefox && \
    echo "Verifying Playwright installation:" && \
    ls -la $PLAYWRIGHT_BROWSERS_PATH

# Copy the rest of the application
COPY . .

# Create necessary directories and set permissions
RUN mkdir -p /app/server/images /app/credentials && \
    chmod -R 777 /app/server/images

# Verify Firefox installation and permissions
RUN echo "Verifying Firefox installation..." && \
    firefox-esr --version && \
    which firefox-esr && \
    ls -l $(which firefox-esr) && \
    ls -la $PLAYWRIGHT_BROWSERS_PATH && \
    echo "Checking Firefox permissions:" && \
    ls -l /usr/bin/firefox* && \
    ls -l /usr/local/bin/firefox* && \
    echo "Checking Xvfb:" && \
    which Xvfb && \
    ls -l $(which Xvfb)

# Create start script with additional checks
RUN echo '#!/bin/bash\n\
set -e\n\
echo "=== Environment Information ==="\n\
env | grep -E "DISPLAY|FIREFOX|PLAYWRIGHT"\n\
echo "\n=== Firefox Information ==="\n\
$FIREFOX_BINARY --version\n\
echo "Binary location: $(which $FIREFOX_BINARY)"\n\
ls -l $(which $FIREFOX_BINARY)\n\
echo "\n=== Playwright Information ==="\n\
ls -la $PLAYWRIGHT_BROWSERS_PATH\n\
echo "\n=== Starting Xvfb ==="\n\
Xvfb :99 -screen 0 1024x768x16 &\n\
sleep 2\n\
echo "Xvfb process:"\n\
ps aux | grep Xvfb\n\
echo "\n=== Starting Node.js Application ==="\n\
cd /app/server\n\
exec node server.js' > /app/start.sh && \
    chmod +x /app/start.sh

# Expose the port
EXPOSE 10000

# Make the start script the default command
ENTRYPOINT ["/app/start.sh"]
