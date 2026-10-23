import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, existsSync } from 'node:fs';
export default defineConfig(({ mode }) => {
  const pages = mode === 'pages';
  const config = existsSync('config/pages.json') ? JSON.parse(readFileSync('config/pages.json', 'utf8')) : {};
  const apiBaseUrl = (process.env.VITE_API_BASE_URL || config.apiBaseUrl || '').trim().replace(/\/+$/, '');
  if (pages && apiBaseUrl && new URL(apiBaseUrl).protocol !== 'https:') throw new Error('Pages 的共享后端必须使用 HTTPS');
  return {
    plugins: [react()],
    base: pages ? '/book_platform/' : '/',
    define: {
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify(pages ? apiBaseUrl : (process.env.VITE_API_BASE_URL || '')),
      'import.meta.env.VITE_REQUIRE_ACCESS_CODE': JSON.stringify(String(pages && !!config.requireAccessCode)),
    },
    build: { outDir: 'dist/client' },
  };
});
