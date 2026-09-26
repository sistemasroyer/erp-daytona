import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        configure(proxy) {
          proxy.on('proxyReq', (proxyReq, req) => {
            // Solo el proxy local informa la IP del cliente, sin reutilizar cabeceras recibidas.
            proxyReq.setHeader('X-Forwarded-For', req.socket.remoteAddress || '127.0.0.1');
          });
        },
      },
    },
  },
})
