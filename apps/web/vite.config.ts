import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'TALENTO - Gestion de Talento Humano',
        short_name: 'TALENTO',
        description: 'Plataforma de gestion de recursos humanos',
        theme_color: '#2563eb',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/portal',
        lang: 'es',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/[^/]+\/api\/v1\/(portal|notifications)/,
            handler: 'NetworkFirst',
            options: { cacheName: 'talento-api', networkTimeoutSeconds: 5 },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@talento/shared': resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: process.env.VITE_API_URL ?? 'http://localhost:3000', changeOrigin: true },
      '/socket.io': {
        target: process.env.VITE_API_URL ?? 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  // `vite preview` sirve el build real. Necesita el mismo proxy para poder
  // comprobar el paquete de produccion contra la API antes de desplegarlo.
  preview: {
    port: 4173,
    proxy: {
      '/api': { target: process.env.VITE_API_URL ?? 'http://localhost:3000', changeOrigin: true },
      '/socket.io': {
        target: process.env.VITE_API_URL ?? 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    // El peso ya se controla por ruta: el enrutador carga cada pagina con
    // `React.lazy`, y los iconos se importan uno a uno. No se fuerza el
    // troceado de dependencias: separar React de las librerias que dependen
    // de el produce un paquete que revienta al cargar
    // ("Cannot read properties of undefined (reading 'useLayoutEffect')"),
    // porque el trozo de React se evalua despues de quien lo necesita.
    chunkSizeWarningLimit: 900,
  },
});
