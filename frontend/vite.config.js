import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    // ── No source maps in production (prevents code inspection) ──
    sourcemap: false,

    // ── Aggressive minification via Terser ──
    minify: 'terser',
    terserOptions: {
      compress: {
        // Strip all console.* calls
        drop_console: true,
        drop_debugger: true,
        // Dead code elimination
        dead_code: true,
        // Collapse variable declarations
        collapse_vars: true,
        // Inline function calls where safe
        inline: 2,
        // Remove unused variables
        unused: true,
        // Evaluate constant expressions
        evaluate: true,
        // Merge consecutive var declarations
        join_vars: true,
        // Discard unreachable code
        sequences: true,
      },
      mangle: {
        // Aggressively mangle all local variable names
        toplevel: true,
        // Mangle property names (obfuscates object keys)
        properties: false, // keep false to avoid breaking runtime behavior
      },
      format: {
        // Strip all comments from output
        comments: false,
        // Compact output
        beautify: false,
      },
    },

    // ── Chunk splitting to obscure structure ──
    rollupOptions: {
      output: {
        // Use hashed filenames so structure is not readable
        entryFileNames: 'assets/[hash].js',
        chunkFileNames: 'assets/[hash].js',
        assetFileNames: 'assets/[hash].[ext]',
        // Split chunks to prevent one large readable file
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) return 'r';
            if (id.includes('recharts') || id.includes('d3')) return 'c';
            if (id.includes('framer-motion')) return 'f';
            if (id.includes('firebase')) return 'b';
            return 'v';
          }
        },
      },
    },

    // Reduce asset inline threshold to split code further
    assetsInlineLimit: 0,
  },
})

