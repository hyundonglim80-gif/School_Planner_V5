// 백업 창 '정리' 탭의 📎 첨부 모으기 (V4 환경설정 '드라이브로 옮기기' - MENU 2-3에서 이 창의 '정리' 탭으로, P8-3).
// V4에서 가져온 첨부 중 예전 Firebase Storage에 있는 것을 드라이브 School_Planner 폴더로 복사하고 V5의 주소만 바꾼다(원본은 그대로 - 서버에 둔 V4 자료가 가리킨다).
// 개인 공간에 남아 있으면 PC 하루 화면 맨 위 띠도 권한다(StorageAttachBanner - 같은 collectRun, P32-1).
import { useMemo, useState } from 'react';
import { useDocs } from '../../data/select';
import { useCurrentSpaceId } from '../../data/session';
import { Section } from '../settings/parts';
import { collectTargets } from './collect';
import { runCollect } from './collectRun';

export default function CollectSection() {
  const sid = useCurrentSpaceId();
  const items = useDocs('items', sid);
  const lessonDays = useDocs('lessonDays', sid);
  const targets = useMemo(() => collectTargets(items, lessonDays), [items, lessonDays]);
  const count = targets.reduce((n, t) => n + t.files.length, 0);
  const [busy, setBusy] = useState('');
  const [result, setResult] = useState('');

  const run = async () => {
    if (!sid || busy || count === 0) return;
    setBusy('옮기는 중…');
    setResult('');
    try {
      const text = await runCollect(sid, setBusy);
      if (text) setResult(text);
    } finally {
      setBusy('');
    }
  };

  return (
    <Section
      id="collect"
      title="📎 첨부 모으기"
      desc="V4에서 가져온 메모·일정·수업 칸의 첨부 가운데 예전 저장소(Firebase Storage)에 있는 것을 구글 드라이브 School_Planner 폴더로 복사하고, V5의 주소를 드라이브 것으로 바꿉니다. 원본은 지우지 않습니다."
    >
      <div data-collect className="space-y-2">
        <p className="text-xs text-slate-600">
          옮길 첨부: <b data-collect-count={count}>{count}개</b>
          {targets.length > 0 && ` (문서 ${targets.length}개)`}
        </p>
        <button
          type="button"
          data-collect-run
          disabled={!!busy || count === 0}
          onClick={() => void run()}
          className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold disabled:opacity-50 cursor-pointer"
        >
          {busy || '📎 드라이브로 모으기'}
        </button>
        {result && (
          <p data-collect-result className="text-xs font-bold text-emerald-700 whitespace-pre-line">
            {result}
          </p>
        )}
      </div>
    </Section>
  );
}
