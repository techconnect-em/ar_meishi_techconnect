import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  // GitHub Pages はサブパス（/ar_meishi_techconnect/）配信なので相対パスでビルドする
  base: './',
  plugins: [basicSsl()],
  server: {
    host: true,
    https: true,
    watch: {
      ignored: ['**/8thwall/**'],
    },
  },
  optimizeDeps: {
    entries: ['index.html'],
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
