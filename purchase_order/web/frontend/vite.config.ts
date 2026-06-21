import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  // 빌드 시 자산 경로 prefix. Django staticfiles 서빙 경로와 일치시킴.
  base: '/static/dist/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // 빌드 산출물을 Django staticfiles로 직접 떨어뜨림
  build: {
    outDir: '../static/dist',
    emptyOutDir: true,
    assetsDir: 'assets',
    sourcemap: true,
  },
  server: {
    port: 5173,
    // 개발 중에는 Django(8000)로 API 요청 프록시
    proxy: {
      '/api':    'http://127.0.0.1:8000',
      '/static': 'http://127.0.0.1:8000',
      '/admin':  'http://127.0.0.1:8000',
    },
  },
})
