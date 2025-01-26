import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    allowedHosts: ['christisking.info', 'christisking-7i4b.vercel.app', 'christisking.vercel.app']
  }
})
