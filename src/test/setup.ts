import '@testing-library/jest-dom/vitest';
// 기기 사본(IndexedDB, P2-2) 테스트가 jsdom에서 돌게 한다.
import 'fake-indexeddb/auto';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// globals: false 라 RTL의 자동 정리가 등록되지 않는다. 직접 붙여 준다.
// (없으면 이전 테스트의 DOM이 남아 조회가 중복으로 잡힌다)
afterEach(() => cleanup());

// 창 위치 '팝업창'(app/popupWindows): jsdom에는 브라우저 새 창이 없다 - '방금 누르지 않음'으로 두어 이 창 안(가운데)에 띄우게 한다.
// 팝업창을 보는 시험은 이 값을 스스로 바꾼다(windows.test).
Object.defineProperty(navigator, 'userActivation', { configurable: true, value: { isActive: false, hasBeenActive: false } });
