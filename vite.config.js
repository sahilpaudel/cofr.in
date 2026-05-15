import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, open: true },
  build: {
    outDir: 'build',
    chunkSizeWarningLimit: 1400,
  },
  resolve: {
    alias: {
      // browser bundle — avoids Node.js fs/path/stream deps in the main entry
      exceljs: 'exceljs/dist/exceljs.min.js',
    },
  },
});
