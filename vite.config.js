import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// IMPORTANT: change '/finance-tracker/' to '/<your-repo-name>/' before deploying
// to GitHub Pages (project pages are served from /<repo-name>/).
export default defineConfig({
  plugins: [react()],
  base: '/finance-tracker/',
})
