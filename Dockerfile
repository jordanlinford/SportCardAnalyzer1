FROM mcr.microsoft.com/playwright:v1.43.0-jammy

# Set environment variables
ENV NODE_ENV=production
ENV DISPLAY=:99
ENV PORT=10000
ENV FIREFOX_BINARY=/usr/bin/firefox-esr
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV DEBIAN_FRONTEND=noninteractive

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
RUN npm install && \
    npx playwright install firefox && \
    npx playwright install-deps firefox

# Copy the rest of the application
COPY . .

# Create necessary directories
RUN mkdir -p /app/server/images /app/credentials

# Verify Firefox installation
RUN echo "Verifying Firefox installation..." && \
    firefox-esr --version && \
    which firefox-esr && \
    ls -l $(which firefox-esr) && \
    ls -la $PLAYWRIGHT_BROWSERS_PATH

# Create start script
RUN echo '#!/bin/bash\n\
echo "Starting with Firefox:"\n\
$FIREFOX_BINARY --version\n\
echo "Firefox binary locations:"\n\
which $FIREFOX_BINARY\n\
ls -l $(which $FIREFOX_BINARY)\n\
echo "Playwright browsers:"\n\
ls -la $PLAYWRIGHT_BROWSERS_PATH\n\
Xvfb :99 -screen 0 1024x768x16 &\n\
sleep 1\n\
exec node server/server.js' > /app/start.sh && \
    chmod +x /app/start.sh

# Expose the port
EXPOSE 10000

# Start the application
CMD ["/app/start.sh"]
