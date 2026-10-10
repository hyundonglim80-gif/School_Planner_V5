// 백업 창 '정리' 탭의 📎 첨부 모으기 (V4 환경설정 '드라이브로 옮기기' - MENU 2-3에서 이 창의 '정리' 탭으로, P8-3).
// V4에서 가져온 첨부 중 예전 Firebase Storage에 있는 것을 드라이브 School_Planner 폴더로 복사하고 V5의 주소만 바꾼다(원본은 V4가 쓰니 그대로).
import { useMemo, useState } from 'react';
import { showErrorToast, showToast, ShownError } from '../../app/toast';
import { useDocs } from '../../data/select';
import { useCurrentSpaceId } from '../../data/session';
import { Section } from '../settings/parts';
import { collectAttachments, collectTargets } from './collect';

const CORS_HELP =
  '브라우저가 Firebase Storage의 파일을 읽지 못하도록 막혀 있습니다(CORS). 버킷에 이 사이트를 한 번 등록하면 풀립니다 - V4 저장소 docs-storage-cors.md의 명령을 Cloud Shell에 붙여 넣고 다시 눌러 주세요.';

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
      const r = await collectAttachments(sid, targets, setBusy);
      if (r.corsBlocked) {
        setResult(CORS_HELP);
        showErrorToast(CORS_HELP);
        return;
      }
      const text = [
        `첨부 ${r.moved}개를 드라이브로 옮겼습니다 (문서 ${r.docs}개의 주소를 바꿨습니다)`,
        r.failed > 0 ? `${r.failed}개는 옮기지 못해 옛 주소 그대로 둡니다` : '',
        r.loginRefused ? '구글 로그인을 하지 않아 멈췄습니다' : '',
      ]
        .filter(Boolean)
        .join(' · ');
      setResult(text);
      showToast(`✅ ${text}`);
      if (r.errors.length > 0) console.warn('첨부 모으기 - 옮기지 못한 것:', r.errors);
    } catch (e) {
      if (!(e instanceof ShownError)) showErrorToast('첨부를 옮기지 못했습니다.', e);
    } finally {
      setBusy('');
    }
  };

  return (
    <Section
      id="collect"
      title="📎 첨부 모으기"
      desc="V4에서 가져온 기록·메모·일정·수업 칸의 첨부 가운데 예전 저장소(Firebase Storage)에 있는 것을 구글 드라이브 School_Planner 폴더로 복사하고, V5의 주소를 드라이브 것으로 바꿉니다. V4가 아직 같은 파일을 쓰므로 원본은 지우지 않습니다."
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
