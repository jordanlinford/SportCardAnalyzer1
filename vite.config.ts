import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  server: {
    port: 5173, // Set fixed port
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  plugins: [
    react(),
    {
      name: 'api-routes',
      configureServer(server) {
        server.middlewares.use('/api/save-search', async (req, res) => {
          if (req.method === 'POST') {
            // Dynamically import the endpoint only when needed
            const { saveSearchEndpoint } = await import('./src/api/save-search')
            const response = await saveSearchEndpoint(req as any)
            res.statusCode = response.status
            res.setHeader('Content-Type', 'application/json')
            res.end(await response.text())
          } else {
            res.statusCode = 405
            res.end(JSON.stringify({ message: 'Method not allowed' }))
          }
        })
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: true,
  },
})