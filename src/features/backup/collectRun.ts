// 📎 첨부 모으기 한 번 (P32-1 - 백업 창 '정리' 탭과 하루 화면 띠가 함께 쓴다). 넣기는 collect, 셈은 domain/attachCollect.
// 드라이브 올리기 코드를 끌어오므로 늘 떠 있는 띠는 누를 때 import() 한다(첫 화면 JS - DESIGN 10장 12).
import { showErrorToast, showToast, ShownError } from '../../app/toast';
import { docsNow } from '../../data/select';
import { collectAttachments, collectTargets } from './collect';

/** 버킷이 이 사이트의 읽기를 막았을 때 - 고치는 것은 저장소 설정이라 선생님은 할 수 없다(명령은 docs/OPS.md '예전 저장소 CORS') */
export const CORS_HELP =
  '브라우저가 예전 저장소(Firebase Storage)의 파일을 읽지 못하게 막혔습니다(CORS). 저장소 설정을 고쳐야 풀립니다 - 개발자에게 알려 주세요.';

// 띠와 정리 탭을 잇달아 누르면 같은 파일을 두 번 올린다 - 한 번에 하나
let running = false;

/** 지금 이 공간에 남은 것을 모은다. 결과 글을 돌려준다(안내도 띄운다) - 옮길 것이 없거나·이미 도는 중이거나·실패를 이미 알렸으면 null */
export async function runCollect(sid: string, onStep?: (msg: string) => void): Promise<string | null> {
  if (running) {
    showToast('📎 첨부를 옮기는 중입니다. 끝나면 다시 눌러 주세요.');
    return null;
  }
  const targets = collectTargets(docsNow('items', sid), docsNow('lessonDays', sid));
  if (targets.length === 0) return null;
  running = true;
  try {
    const r = await collectAttachments(sid, targets, onStep);
    if (r.corsBlocked) {
      // 오류를 함께 주면 개발자 오류 기록에도 남는다(선생님이 알리지 않아도 안다)
      showErrorToast(CORS_HELP, new Error('예전 저장소 CORS 막힘'));
      return CORS_HELP;
    }
    const text = [
      `첨부 ${r.moved}개를 드라이브로 옮겼습니다 (문서 ${r.docs}개의 주소를 바꿨습니다)`,
      r.failed > 0 ? `${r.failed}개는 옮기지 못해 옛 주소 그대로 둡니다` : '',
      r.loginRefused ? '구글 로그인을 하지 않아 멈췄습니다' : '',
    ]
      .filter(Boolean)
      .join(' · ');
    showToast(`✅ ${text}`);
    if (r.errors.length > 0) console.warn('첨부 모으기 - 옮기지 못한 것:', r.errors);
    return text;
  } catch (e) {
    if (!(e instanceof ShownError)) showErrorToast('첨부를 옮기지 못했습니다.', e);
    return null;
  } finally {
    running = false;
  }
}
