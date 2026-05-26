import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const API_PORT      = process.env.API_PORT      ?? '4314'
const FRONTEND_PORT = process.env.FRONTEND_PORT ?? '4142'

export default defineConfig({
  plugins: [react()],
  server: {
    port: parseInt(FRONTEND_PORT),
    proxy: {
      '/api': {
        target: `http://localhost:${API_PORT}`,
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api/, ''),
      },
    },
  },
})
