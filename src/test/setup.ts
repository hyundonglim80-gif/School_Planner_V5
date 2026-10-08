import '@testing-library/jest-dom/vitest';
// 기기 사본(IndexedDB, P2-2) 테스트가 jsdom에서 돌게 한다.
import 'fake-indexeddb/auto';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// globals: false 라 RTL의 자동 정리가 등록되지 않는다. 직접 붙여 준다.
// (없으면 이전 테스트의 DOM이 남아 조회가 중복으로 잡힌다)
afterEach(() => cleanup());
