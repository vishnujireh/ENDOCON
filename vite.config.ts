import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        // The static registration catalogue shared with the backend (../shared/catalogue.json).
        '@shared': path.resolve(__dirname, '../shared'),
      },
    },
    server: {
      // Allow the dev server to read ../shared (outside this project folder).
      fs: { allow: [path.resolve(__dirname), path.resolve(__dirname, '../shared')] },
      // In development the API is proxied so the browser sees one origin (cookies + CSRF just work).
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY_TARGET || 'http://localhost:4100',
          changeOrigin: false,
        },
      },
    },
  };
});
