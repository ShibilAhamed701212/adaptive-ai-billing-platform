import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Proxy to whatever port the backend is configured to listen on (backend/.env PORT), so the two
  // can't drift apart. Default 5001: on macOS port 5000 belongs to the AirPlay receiver.
  const backendEnv = loadEnv(mode, fileURLToPath(new URL('../backend', import.meta.url)), '');
  const apiPort = process.env.API_PORT || backendEnv.PORT || '5001';

  return {
    plugins: [react()],
    resolve: {
      alias: {
        // Bundle the shared workspace from source so runtime constants (module presets,
        // business-type labels) are resolvable instead of the CommonJS dist output.
        '@billing/shared': fileURLToPath(new URL('../shared/src/index.ts', import.meta.url)),
      },
    },
    server: {
      host: true,
      port: 5173,
      proxy: {
        '/api': {
          target: `http://localhost:${apiPort}`,
          changeOrigin: true,
        },
      },
    },
  };
});
