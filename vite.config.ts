import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const repository = process.env.GITHUB_REPOSITORY?.split('/').at(-1);
const base = process.env.GITHUB_ACTIONS === 'true' && repository ? `/${repository}/` : '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon.svg'],
      manifest: {
        name: '豆格工坊 · 拼豆图案生成工具',
        short_name: '豆格工坊',
        description: '纯本地拼豆图案转换、编辑、统计与导出工具',
        lang: 'zh-CN',
        theme_color: '#f6f1e8',
        background_color: '#f6f1e8',
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [{ src: `${base}icon.svg`, sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }]
      },
      workbox: {
        navigateFallback: `${base}index.html`,
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,html,svg,csv}']
      }
    })
  ],
  worker: { format: 'es' },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    exclude: ['tests/e2e/**', 'node_modules/**', 'dist/**'],
    coverage: { reporter: ['text', 'html'] }
  }
});
