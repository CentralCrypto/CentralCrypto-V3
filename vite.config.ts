import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 3000,
    strictPort: true,
    proxy: {
      // Cachecko (arquivos JSON estáticos)
      '/cachecko': {
        target: 'https://centralcrypto.com.br',
        changeOrigin: true,
        secure: true,
      },

      // WordPress REST API (pega tudo do wp-json, não só wp/v2)
      '/2/wp-json': {
        target: 'https://centralcrypto.com.br',
        changeOrigin: true,
        secure: true,
        secure: true,
      },

      // Mídias/uploads
      '/2/wp-content': {
        target: 'https://centralcrypto.com.br',
        changeOrigin: true,
        secure: true,
      },
    },
  },
});
