import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// base: './' 로 두면 GitHub Pages 등 하위 경로에 올려도 동작합니다.
export default defineConfig({
  base: './',
  plugins: [react()],
  test: { environment: 'node' },
})
