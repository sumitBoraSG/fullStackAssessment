import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Overridable so the proxy can point at a Docker service name (e.g.
// "http://backend:3000") instead of localhost when running in a container.
const backendTarget = process.env.VITE_BACKEND_URL || 'http://localhost:3000';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5173,
    allowedHosts: ['blooming-visiting-colony.ngrok-free.dev'],
    proxy: {
      '/auth': { target: backendTarget, changeOrigin: true },
      '/admin': { target: backendTarget, changeOrigin: true },
      '/doctor': { target: backendTarget, changeOrigin: true },
      '/doctors': { target: backendTarget, changeOrigin: true },
      '/patient': { target: backendTarget, changeOrigin: true },
      '/appointments': { target: backendTarget, changeOrigin: true },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setupTests.ts'],
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'src/test/**',
        'src/main.tsx',
        'src/vite-env.d.ts',
        '**/*.d.ts',
      ],
    },
  },
});
