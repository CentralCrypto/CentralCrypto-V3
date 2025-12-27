
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Túnel para os arquivos de dados estáticos do servidor
      '/cachecko': {
        target: 'https://centralcrypto.com.br',
        changeOrigin: true,
        secure: true,
      },
      // Túnel para a API nativa do WP Core (Magazine)
      '/2/wp-json/wp/v2': {
        target: 'https://centralcrypto.com.br',
        changeOrigin: true,
        secure: true,
      },
      // Túnel para mídias e uploads
      '/2/wp-content': {
        target: 'https://centralcrypto.com.br',
        changeOrigin: true,
        secure: true,
      }
    },
  },
});
