import { defineConfig } from 'vitest/config';

// 자료 층 테스트 (에뮬레이터). `npm run emu`를 켠 뒤 `npm run test:data`.
// 저장 도우미·되돌리기·규칙이 실제 Firestore(에뮬레이터)에서 함께 맞는지 본다 - 단위 테스트는 Firestore를 흉내 낸다.
// CI는 돌리지 않는다(에뮬레이터가 없다 - 단위만). 파일 이름은 *.emu.test.ts (단위 설정은 빼고 돈다).
export default defineConfig({
  define: {
    __BUILD_ID__: JSON.stringify('test'),
    // src/data/firebase.ts가 에뮬레이터(auth 9099·firestore 8080)에 붙는다
    __USE_EMULATOR__: JSON.stringify(true),
  },
  test: {
    // 안내(toast)를 그리려고 jsdom. Firestore는 node 판(gRPC)이라 vm 대신 프로세스로 돈다
    environment: 'jsdom',
    pool: 'forks',
    globals: false,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.emu.test.ts'],
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
