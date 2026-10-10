import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// 지금 브라우저가 어느 빌드를 돌리고 있는지 화면에서 확인할 수 있게 한다(V4에서 가져온 규칙 -
// 이것이 없을 때 고친 것이 그 기기에서 돌고 있는지 몰라 '고쳤는데 그대로'를 여러 번 주고받았다).
// 한국 시각으로 적는다 - V4는 UTC라 화면의 빌드 번호가 9시간 앞섰다. 자동 배포(GitHub Actions)는 UTC 기기에서 빌드하므로 기기 시간대가 아니라 +9시간으로 센다.
const BUILD_ID = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 16).replace('T', ' ');

export default defineConfig(({ mode }) => ({
  // V5는 Firebase Hosting 새 사이트의 맨 위에 선다(V3·V4의 github.io 하위 경로와 출처를 나누려고 - PLAN 2장).
  base: '/',
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
    // 점검용 에뮬레이터에 붙는 빌드인가(`--mode emu` 또는 VITE_USE_EMULATOR=1 - V4와 같은 변수).
    // 상수라 운영 빌드에서는 에뮬레이터 코드가 통째로 빠진다(src/data/emulator.ts).
    __USE_EMULATOR__: JSON.stringify(mode === 'emu' || process.env.VITE_USE_EMULATOR === '1'),
  },
  plugins: [
    react(),
    tailwindcss(),
  ],
  // 서비스 워커가 이 판의 앱 파일을 미리 담을 목록 (public/sw.js precache - P8-3 오프라인 앱).
  // 점(.)으로 시작하는 기본 자리(.vite/)는 Firebase Hosting이 올리지 않아 맨 위에 둔다.
  build: { manifest: 'asset-manifest.json' },
  // V4 개발 서버(5173)·미리 보기(4173)와 같이 켜 둘 수 있게 번호를 비킨다.
  server: { port: 5175, strictPort: true },
  preview: { port: 4175, strictPort: true },
}))
