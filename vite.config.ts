import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// 지금 브라우저가 어느 빌드를 돌리고 있는지 화면에서 확인할 수 있게 한다(V4에서 가져온 규칙 -
// 이것이 없을 때 고친 것이 그 기기에서 돌고 있는지 몰라 '고쳤는데 그대로'를 여러 번 주고받았다).
const BUILD_ID = new Date().toISOString().slice(0, 16).replace('T', ' ');

export default defineConfig({
  // V5는 Firebase Hosting 새 사이트의 맨 위에 선다(V3·V4의 github.io 하위 경로와 출처를 나누려고 - PLAN 2장).
  base: '/',
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  plugins: [
    react(),
    tailwindcss(),
  ],
  // V4 개발 서버(5173)·미리 보기(4173)와 같이 켜 둘 수 있게 번호를 비킨다.
  server: { port: 5175, strictPort: true },
  preview: { port: 4175, strictPort: true },
})
