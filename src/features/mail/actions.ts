// 쪽지 지우기 (P15-2 ■1 - PLAN 5장 'P15 지우기'): 목록에서 바로 숨기고 7초 '되돌리기' 안내, 안내가 닫히면 진짜 지운다.
//   쪽지는 공간 밖(v5Mail)이라 되돌리기 더미(Ctrl+Z)·휴지통을 거치지 않는다. 받은 쪽지는 보낸 사람만 만들 수 있어(규칙) 지운 뒤 다시 만들 수 없다 -
//   그래서 지우기를 늦춘다. 7초 안에 앱을 닫으면 지워지지 않고 남는다(잃는 쪽이 아님).
//   숨긴 id는 이 탭이 열린 동안 기억한다 - 창을 닫았다 다시 열어도(아직 서버에 있는 동안) 다시 보이지 않게.
import { create } from 'zustand';
import { showToast } from '../../app/toast';
import { deleteMail } from '../../data/mail';
import { UNDO_LABEL, UNDO_TOAST_MS } from '../../data/undo';
import type { MailBox } from '../../domain/mail';

export const useHiddenMail = create<{ ids: ReadonlySet<string> }>(() => ({ ids: new Set() }));

const setHidden = (id: string, on: boolean) =>
  useHiddenMail.setState((s) => {
    const ids = new Set(s.ids);
    if (on) ids.add(id);
    else ids.delete(id);
    return { ids };
  });

/** 내 목록에서 지우기 - 받은 쪽지를 지워도 보낸 사람의 사본·다른 사람이 받은 것은 그대로 */
export function removeMail(uid: string, box: MailBox, id: string) {
  setHidden(id, true);
  showToast('🗑️ 쪽지를 지웠습니다.', UNDO_TOAST_MS, 'info', {
    label: UNDO_LABEL,
    run: () => {
      setHidden(id, false);
      showToast('↩️ 되돌렸습니다.');
    },
    expire: () => {
      // 실패하면(안내는 deleteMail이) 다시 보인다
      void deleteMail(uid, box, id).then((ok) => ok || setHidden(id, false));
    },
  });
}
