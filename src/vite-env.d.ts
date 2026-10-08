/// <reference types="vite/client" />

/** 빌드 시각. vite.config.ts의 define으로 넣는다(테스트는 vitest.config.ts의 'test'). */
declare const __BUILD_ID__: string;

/** 점검용 에뮬레이터에 붙는 빌드인가. vite.config.ts의 define(테스트는 false). */
declare const __USE_EMULATOR__: boolean;
