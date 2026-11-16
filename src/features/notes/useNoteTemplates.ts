// 내 메모 틀 목록 (P36-2) - 쓰는 칸의 '📋 틀'이 처음 쓸 때 듣기 시작해, 로그인한 사람이 바뀔 때까지 듣는다(문서 하나 - 칸을 다시 열 때 '받는 중'이 없게).
//   로그아웃·다른 계정이면 멈추고 비운다(다음 사람이 앞 사람 틀을 보지 않게).
import { useEffect } from 'react';
import { create } from 'zustand';
import { useSession } from '../../data/session';
import { watchNoteTemplates } from '../../data/noteTemplates';
import { readNoteTemplates, type NoteTemplate } from '../../domain/noteTemplate';

interface TemplatesState {
  uid: string | null;
  /** 서버 문서 그대로 (되돌리기 before) */
  raw: Record<string, unknown> | null;
  list: NoteTemplate[];
  /** 서버에서 한 번 받았나 */
  loaded: boolean;
}

const EMPTY: TemplatesState = { uid: null, raw: null, list: [], loaded: false };
export const useNoteTemplateStore = create<TemplatesState>(() => EMPTY);

let stop: (() => void) | null = null;

function stopWatching() {
  stop?.();
  stop = null;
  useNoteTemplateStore.setState(EMPTY);
}

function startWatching(uid: string) {
  if (stop && useNoteTemplateStore.getState().uid === uid) return;
  stopWatching();
  useNoteTemplateStore.setState({ ...EMPTY, uid });
  stop = watchNoteTemplates(uid, (raw) => {
    if (useNoteTemplateStore.getState().uid !== uid) return;
    useNoteTemplateStore.setState({ raw, list: readNoteTemplates(raw), loaded: true });
  });
}

useSession.subscribe((s, prev) => {
  if (s.user?.uid !== prev.user?.uid && stop) stopWatching();
});

/** 내 틀 (uid = 로그인한 사람 - 없으면 빈 목록) */
export function useNoteTemplates(): TemplatesState {
  const uid = useSession((s) => s.user?.uid ?? null);
  useEffect(() => {
    if (uid) startWatching(uid);
  }, [uid]);
  const state = useNoteTemplateStore();
  return uid && state.uid === uid ? state : EMPTY;
}
