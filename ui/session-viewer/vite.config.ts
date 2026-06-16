import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { sessionApiPlugin } from './server/viteSessionApiPlugin'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), sessionApiPlugin()],
})
