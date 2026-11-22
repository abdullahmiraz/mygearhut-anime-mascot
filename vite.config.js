import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL('./index.html', import.meta.url)),
        anime: fileURLToPath(new URL('./anime.html', import.meta.url)),
        animeV2: fileURLToPath(new URL('./anime-v2.html', import.meta.url)),
      },
    },
  },
});
