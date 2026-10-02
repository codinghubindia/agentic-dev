---
name: react-vite-postcss
description: "Production guidelines for React with Vite and PostCSS, covering bundler configuration, HMR Fast Refresh, PostCSS pipeline, CSS modules, asset aliasing, and API proxying."
category: development
tags: [react, vite, postcss, frontend, bundler, tailwind, css-modules]
license: "MIT"
---

# React, Vite, and PostCSS Architecture

## Overview

Authoritative standards for modern single-page frontend applications powered by React 18/19, Vite, and PostCSS. Focuses on sub-second dev server startup, hot module replacement (HMR) stability, deterministic bundling, and CSS asset pipelines.

## Project Scaffolding

Always scaffold using the official Vite CLI:

```bash
# Non-interactive React + TypeScript scaffold
npm create vite@latest my-app -- --template react-ts
cd my-app
npm install

# PostCSS and CSS tooling
npm install -D postcss autoprefixer postcss-preset-env
```

## Recommended Project Structure

```
src/
├── assets/             # Static SVGs, images, fonts
├── components/         # Reusable UI leaf components
│   ├── Button/
│   │   ├── Button.tsx
│   │   ├── Button.module.css
│   │   └── index.ts
├── hooks/              # Custom React hooks (use*.ts)
├── layouts/            # Page shells and persistent layouts
├── pages/              # Route views
├── services/           # Typed API fetchers
├── types/              # Centralized TypeScript definitions
├── App.tsx             # Root component and router tree
├── main.tsx            # Entry point (createRoot)
└── vite-env.d.ts       # Environment variable type declarations
```

## Configuration Standards

### 1. `vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [
    react({
      // Ensures React Fast Refresh functions predictably
      fastRefresh: true,
    }),
  ],
  resolve: {
    alias: {
      // Path aliasing for clean, refactor-safe imports
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    strictPort: true,
    // Reverse proxy to prevent CORS issues in development
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    target: 'esnext',
    sourcemap: false,
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        // Deterministic vendor chunk splitting to maximize HTTP caching
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) {
              return 'vendor-react';
            }
            if (id.includes('framer-motion') || id.includes('lucide-react')) {
              return 'vendor-ui';
            }
            return 'vendor-core';
          }
        },
      },
    },
  },
});
```

### 2. `postcss.config.js`

```javascript
export default {
  plugins: {
    // Stage 3 modern CSS features polyfilling
    'postcss-preset-env': {
      stage: 3,
      features: {
        'nesting-rules': true,
        'custom-properties': true,
      },
    },
    // Automatic vendor prefixing based on browserslist
    autoprefixer: {},
  },
};
```

## Core Invariants

1. **HMR Preservation**: Only export React components from component files. Exporting non-component constants or utilities from a `.tsx` file breaks Vite's React Fast Refresh, forcing full page reloads.
2. **Environment Variables**: Always prefix public environment variables with `VITE_` (e.g. `VITE_API_URL`). Access via `import.meta.env.VITE_*`. Type these inside `src/vite-env.d.ts`.
3. **CSS Modules**: For scoped component styles, name files with `.module.css`. Import as `import styles from './Component.module.css'`.
4. **SVG Ingestion**: Prefer vector icon libraries (`lucide-react`) over raw inline SVG blobs.
