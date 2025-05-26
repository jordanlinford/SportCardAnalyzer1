FROM mcr.microsoft.com/playwright:v1.43.0-jammy

# Set environment variables
ENV NODE_ENV=production \
    DISPLAY=:99 \
    PORT=10000

# Install Xvfb
RUN apt-get update && \
    apt-get install -y xvfb && \
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
RUN mkdir -p /app/server/images /app/credentials && \
    chmod -R 777 /app/server/images

# Create start script
RUN echo '#!/bin/bash\n\
echo "Starting Xvfb..."\n\
Xvfb :99 -screen 0 1024x768x16 &\n\
sleep 2\n\
echo "Starting Node.js application..."\n\
cd /app/server\n\
exec node server.js' > /app/start.sh && \
    chmod +x /app/start.sh

# Expose the port
EXPOSE 10000

# Start the application
ENTRYPOINT ["/app/start.sh"]
