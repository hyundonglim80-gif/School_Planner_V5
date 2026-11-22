// 구글 캘린더 자동 보내기 - 문 (P8-1 · P55-1 첫 화면 JS). Shell·새 창(PopoutShell)에 하나.
//   큐(gcalQueue)는 늘 듣는다(머리줄 '📅 못 보낸 일정 N' - 다른 기기가 넣은 것도). 보내는 몫(auto - 쓰기 지켜보기·구글에 보내기)은
//   그 개인 공간에 '구글 캘린더'를 켠 일정 라벨이나 일정(일정 칸에서 따로 켠 것)이 있거나 큐가 차 있을 때만 받아 세운다.
//   한 번 서면 그 공간에서는 멈추지 않는다 - 라벨을 끈 뒤 구글에서 지울 것을 큐에 넣고 보내야 한다.
//   일정 칸에서 처음 따로 켠 일정은 일정 칸이 저장 앞에 세운다(EventPanel → auto runGcalAuto - 그 저장도 지켜본다).
import { useEffect, useState } from 'react';
import { labelProps } from '../../domain/labels';
import { watchGcalQueue } from '../../data/gcalQueue';
import { collKey, EMPTY_DOCS, useMirror } from '../../data/mirror/store';
import { useMirrorStatus, type Docs } from '../../data/select';
import { usePersonalSpaceId } from '../../data/session';
import { useToday } from '../../ui/useToday';
import { useGcal } from './gcalStore';

type AutoModule = typeof import('./auto');

/** 받은 보내는 몫 (머리줄 단추가 누른 그 자리에서 부른다 - 로그인 창이 막히지 않게) */
let auto: AutoModule | null = null;
let loading: Promise<AutoModule> | null = null;

function loadAuto(): Promise<AutoModule> {
  loading ??= import('./auto').then(
    (m) => (auto = m),
    (e: unknown) => {
      loading = null; // 다음에 다시 받아 본다
      throw e;
    },
  );
  return loading;
}

/** 한 번 세운 공간 (이 탭) */
const kept = new Set<string>();

const labelsOn = new WeakMap<object, boolean>();
const itemsOn = new WeakMap<object, boolean>();

/** '구글 캘린더'를 켠 일정 라벨이 있나 (문서 표마다 한 번 셈) */
function anyGcalLabel(labels: Docs<'labels'>): boolean {
  let on = labelsOn.get(labels);
  if (on === undefined) {
    on = Object.values(labels).some((l) => l.kind === 'event' && !l.deletedAt && labelProps(l.props).gcal);
    labelsOn.set(labels, on);
  }
  return on;
}

/** 일정 칸에서 '구글 캘린더'를 따로 켠 일정이 있나 (domain/gcal gcalOn - props.gcal이 라벨보다 먼저) */
function anyGcalItem(items: Docs<'items'>): boolean {
  let on = itemsOn.get(items);
  if (on === undefined) {
    on = Object.values(items).some((d) => d.kind === 'event' && !d.deletedAt && d.props?.gcal === true);
    itemsOn.set(items, on);
  }
  return on;
}

/** Shell에 하나: 큐를 듣고, 보낼 것이 있는 공간이면 보내는 몫을 받아 세운다 (쓰기를 큐에 넣고, 앱을 열 때·날이 바뀔 때 이월 일정을 오늘로, 쌓인 것을 조용히 보낸다) */
export function useGcalAuto() {
  const sid = usePersonalSpaceId();
  const items = useMirrorStatus('items', sid);
  const labels = useMirrorStatus('labels', sid);
  const today = useToday();
  const ready = items === 'live' && labels === 'live';
  // 문서 표가 바뀔 때만 다시 센다(셈은 표마다 한 번) - 그리기는 참·거짓이 바뀔 때만
  const used = useMirror((s) => {
    if (!sid) return false;
    const docs = (c: 'labels' | 'items') => s.colls[collKey(sid, c)]?.docs ?? EMPTY_DOCS;
    return anyGcalLabel(docs('labels') as unknown as Docs<'labels'>) || anyGcalItem(docs('items') as unknown as Docs<'items'>);
  });
  const pending = useGcal((s) => s.pending);
  const want = !!sid && (used || pending > 0 || kept.has(sid));
  const [mod, setMod] = useState<AutoModule | null>(auto);

  // 큐 - 늘 (끊기면 빈 큐)
  useEffect(() => {
    if (!sid) return;
    const off = watchGcalQueue(sid, (entries) => useGcal.setState({ queue: entries, pending: entries.length }));
    return () => {
      off();
      useGcal.setState({ queue: [], pending: 0 });
    };
  }, [sid]);

  // 보내는 몫
  useEffect(() => {
    if (!sid || !want) return;
    kept.add(sid);
    let gone = false;
    loadAuto().then(
      (m) => {
        if (gone) return;
        m.runGcalAuto(sid);
        setMod(m);
      },
      (e: unknown) => console.warn('[gcal] 구글 캘린더 보내는 몫을 받지 못했습니다.', e),
    );
    return () => {
      gone = true;
      auto?.stopGcalAuto(sid);
    };
  }, [sid, want]);

  // 앱을 열 때·날이 바뀔 때 (사본·라벨을 받은 뒤)
  useEffect(() => {
    if (!mod || !sid || !want || !ready) return;
    return mod.gcalReadyToday(sid);
  }, [mod, sid, want, ready, today]);
}

/** 머리줄 '📅 못 보낸 일정 N' - 큐가 차 있으면 보내는 몫은 이미 받았다(누른 그 자리에서 로그인 창을 연다) */
export function sendGcalNow(): void {
  if (auto) void auto.sendGcalNow();
  else void loadAuto().then((m) => m.sendGcalNow());
}
