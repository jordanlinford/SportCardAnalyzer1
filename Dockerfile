FROM mcr.microsoft.com/playwright:v1.43.0-jammy

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies and browsers
RUN npm install && \
    npx playwright install && \
    npx playwright install-deps

# Copy the rest of the application
COPY . .

# Set environment variables
ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV DISPLAY=:99

# Install xvfb
RUN apt-get update && \
    apt-get install -y xvfb && \
    rm -rf /var/lib/apt/lists/*

# Create a script to start Xvfb and the application
RUN echo '#!/bin/bash\nXvfb :99 -screen 0 1024x768x16 &\nsleep 1\nnode server/server.js' > /app/start.sh && \
    chmod +x /app/start.sh

# Expose the port the app runs on
EXPOSE 3000

# Start the application with Xvfb
CMD ["/app/start.sh"]
