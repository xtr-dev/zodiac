import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'examples',
  server: {
    port: 5173,
    open: true
  },
  build: {
    outDir: '../dist-examples',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'examples/index.html')
      }
    }
  }
});