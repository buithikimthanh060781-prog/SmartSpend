import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  build: {
    // ExcelJS (~940 kB) được tải riêng (dynamic import) và chỉ khi người dùng bấm "Xuất Excel", không nằm trong bản tải đầu tiên.
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          supabase: ['@supabase/supabase-js', '@tanstack/react-query'],
        },
      },
    },
  },
});
