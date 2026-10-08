import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// 컴포넌트 테스트용 설정.
// 앱 빌드(vite.config.ts)와 분리해 두어 tailwind 플러그인 등을 끌어들이지 않는다.
export default defineConfig({
  plugins: [react()],
  define: {
    __BUILD_ID__: JSON.stringify('test'),
    __USE_EMULATOR__: JSON.stringify(false),
  },
  test: {
    environment: 'jsdom',
    // 기본 풀은 테스트 파일마다 jsdom을 새로 만들어 시간을 많이 쓴다(V4: 208초 → 45초).
    pool: 'vmThreads',
    globals: false,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // 자료 층 테스트(에뮬레이터)는 따로 - vitest.data.config.ts
    exclude: [...configDefaults.exclude, 'src/**/*.emu.test.ts'],
  },
});
