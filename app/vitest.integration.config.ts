import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Cấu hình riêng cho kiểm thử tích hợp (Supabase thật, 2 tài khoản test). Không chạy trong `npm test`.
export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: {
    include: ['src/integration/**/*.integration.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});
