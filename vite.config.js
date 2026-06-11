import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // 如果你要部署到 https://vf0936174-lab.github.io/V2-Flashcard/
  base: '/V2-Flashcard/',
  plugins: [react()]
})
