import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  // Relative asset paths, so the build works from any folder, not just the root.
  base: './',
  plugins: [svelte()],
  resolve: {
    alias: [
      {
        find: /^arrow-cards\/svelte$/,
        replacement: fileURLToPath(new URL('./arrow-cards/src/svelte/ArrowCard.svelte', import.meta.url)),
      },
      {
        find: /^arrow-cards$/,
        replacement: fileURLToPath(new URL('./arrow-cards/src/index.ts', import.meta.url)),
      },
    ],
  },
  server: {
    port: 3000,
    host: true,
  },
});
