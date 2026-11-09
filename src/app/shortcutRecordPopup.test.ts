// 단축키 설정을 팝업창(창 위치 '팝업창')의 환경설정에서 시작할 때 (P28-1) - 띠는 큰 창에만 있어 큰 창에 알린다.
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../ui/popout', async (orig) => ({ ...(await orig<typeof import('../ui/popout')>()), POPOUT: { id: 'settings', params: null } }));
const sent = vi.hoisted(() => [] as (string | undefined)[]);
vi.mock('./popupWindows', async (orig) => ({
  ...(await orig<typeof import('./popupWindows')>()),
  sendRecordToOpener: vi.fn((id?: string) => sent.push(id)),
}));

import { cancelShortcutRecord, requestShortcutRecord, startRecordFromPopup, useShortcutRecord } from './shortcutRecord';

afterEach(() => cancelShortcutRecord());

describe('팝업창에서 단축키 설정', () => {
  it('팝업창 안이면 큰 창에 알리고(true - 부르는 쪽이 팝업창을 닫는다) 여기서는 시작하지 않는다', () => {
    expect(requestShortcutRecord()).toBe(true);
    expect(requestShortcutRecord('timetable')).toBe(true);
    expect(sent).toEqual([undefined, 'timetable']);
    expect(useShortcutRecord.getState().stage).toBe('off');
  });

  it('큰 창이 받은 부탁 - 없으면 고르기, 아는 것이면 그 키만, 모르는 것은 아무 일도 없다', () => {
    startRecordFromPopup('nope');
    expect(useShortcutRecord.getState().stage).toBe('off');
    startRecordFromPopup('settings:notify');
    expect(useShortcutRecord.getState()).toMatchObject({ stage: 'key', picked: 'settings:notify' });
    startRecordFromPopup();
    expect(useShortcutRecord.getState()).toMatchObject({ stage: 'pick', picked: null });
  });
});
