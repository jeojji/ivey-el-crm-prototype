import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { localAiPlugin } from './server/localAi';

// base './' makes asset paths relative, so the built app works at any
// GitHub Pages repository path (https://<user>.github.io/<repo>/).
// localAiPlugin adds /local-ai/* to the local dev/preview server only. The GitHub Pages build is
// static files, so local AI doesn't exist there (and VITE_DEMO_MODE=true says so in the UI).
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), localAiPlugin()],
});
