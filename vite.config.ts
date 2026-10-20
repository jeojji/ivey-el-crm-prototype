import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// base './' makes asset paths relative, so the built app works at any
// GitHub Pages repository path (https://<user>.github.io/<repo>/).
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
});
