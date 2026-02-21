import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const isDev = mode === 'development';

  return {
    plugins: [react()],

    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },

    server: {
      port: 3000,
      host: '0.0.0.0',
      // Proxy /api requests to the backend in development
      proxy: {
        '/api': {
          target: 'http://localhost:5000',
          changeOrigin: true,
          secure: false,
        },
      },
    },

    build: {
      outDir: 'dist',
      sourcemap: false, // Disable in production to avoid leaking source
      minify: 'esbuild',
      // Split vendor chunks for better caching
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom'],
            genai: ['@google/genai'],
            pdf: ['pdfjs-dist'],
            icons: ['lucide-react'],
          },
        },
      },
      // Warn if any chunk exceeds 500kb
      chunkSizeWarningLimit: 500,
    },

    // Expose only specific env vars to the client bundle
    envPrefix: 'VITE_',

    // Optimise deps for faster dev server start
    optimizeDeps: {
      include: ['react', 'react-dom', '@google/genai', 'lucide-react'],
    },
  };
});
