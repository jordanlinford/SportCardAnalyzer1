# Server Starter Script

This directory contains scripts to help manage the server in different environments.

## server-starter.js

This script provides a smart way to start the server in different environments:

### Features

- **Port Management**: Automatically detects and handles port conflicts (frees up port 3001 if it's already in use)
- **Environment Detection**: Works differently in Vercel vs local development
- **Process Management**: Properly handles process termination signals

### Usage

To use the script:

```bash
# From the server directory
npm run dev

# Or from the project root
npm run dev:server

# To run both frontend and backend together
npm run dev:all
```

### How It Works

In **development mode**, the script:
1. Checks if port 3001 is already in use
2. If it is, attempts to free the port by killing existing processes
3. Starts the server with nodemon for auto-reloading

In **Vercel production**, the script:
- Detects the Vercel environment
- Skips starting a standalone server (uses serverless functions instead)

## Troubleshooting

If you encounter port conflicts that persist:

1. Manually kill processes on port 3001:
   ```bash
   # On macOS/Linux
   lsof -i :3001 -t | xargs kill -9
   
   # On Windows
   netstat -ano | findstr :3001
   taskkill /F /PID <PID>
   ```

2. Try starting with a different port:
   ```bash
   PORT=3002 npm run dev
   ``` 