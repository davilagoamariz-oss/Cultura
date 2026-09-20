import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'Ronda do Pomar',
        short_name: 'Ronda',
        description: 'Monitoramento semanal de pragas e doenças do limão Tahiti',
        lang: 'pt-BR',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        theme_color: '#14532d',
        background_color: '#ffffff',
        icons: [
          { src: '/icone-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icone-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icone-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // O Firestore guarda os dados no IndexedDB; o service worker só cacheia o app em si.
        globPatterns: ['**/*.{js,css,html,png,svg,ico,webmanifest}'],
        navigateFallback: '/index.html',
      },
    }),
  ],
});
