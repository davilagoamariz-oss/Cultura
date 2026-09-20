import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// O nome do sistema vem de VITE_APP_NAME (padrão: Ronda do Pomar) e o nome curto, que aparece
// embaixo do ícone no celular, de VITE_APP_SHORT_NAME. Trocar de marca não exige mexer no código.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const nome = env.VITE_APP_NAME || 'Ronda do Pomar';
  const nomeCurto = env.VITE_APP_SHORT_NAME || 'Ronda';

  return {
    define: {
      'import.meta.env.VITE_APP_NAME': JSON.stringify(nome),
    },
    plugins: [
      react(),
      { name: 'nome-do-app', transformIndexHtml: (html) => html.replaceAll('%NOME_APP%', nome) },
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['apple-touch-icon.png'],
        manifest: {
          name: nome,
          short_name: nomeCurto,
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
  };
});
