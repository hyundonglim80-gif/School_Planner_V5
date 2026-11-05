// 쪽지 받기 (P15-2 ■3) - Shell에 하나(큰 창만 - 새 창 PopoutShell은 하지 않는다, 두 번 읽지 않게).
//   - 안 읽은 쪽지 듣기(data/mail useMailWatch → 머리줄 ✉ n) + 앱을 연 뒤 새로 온 쪽지 안내 '✉ ○○ 선생님의 쪽지 - 보기'.
//     쪽지 창이 보이고 있으면 띄우지 않는다(창이 목록에 더한다). 끊겼다 이어져 한꺼번에 오면 '새 쪽지 n통' 하나로.
//   - 푸시 알림을 눌러 연 앱: 주소 '?mail=<id>'(public/sw.js notificationclick)를 꺼내 지우고 쪽지 창 → 그 쪽지(?share= 본보기).
//   - 열린 앱 창에서 알림을 누름: 서비스 워커 메시지 'sp5-open-mail'.
import { useEffect } from 'react';
import { showToast } from '../../app/toast';
import { shownWindowNow } from '../../app/windows';
import { useMailWatch } from '../../data/mail';
import { useSession } from '../../data/session';
import { mailParamOf, newMailNotice, stripMailParam, type MailIn } from '../../domain/mail';
import { MAIL_WINDOW, openMail } from './open';

// 한꺼번에 온 것을 모아 안내 하나로
const NOTICE_GATHER_MS = 400;
const NOTICE_MS = 6000;
let gathered: MailIn[] = [];
let gatherTimer: ReturnType<typeof setTimeout> | null = null;

function noticeNew(m: MailIn) {
  gathered.push(m);
  if (gatherTimer) return;
  gatherTimer = setTimeout(() => {
    const list = gathered;
    gathered = [];
    gatherTimer = null;
    if (shownWindowNow()?.id === MAIL_WINDOW) return;
    if (list.length === 1) showToast(newMailNotice(list[0]), NOTICE_MS, 'info', { label: '보기', run: () => openMail({ id: list[0].id }) });
    else showToast(`✉ 새 쪽지 ${list.length}통`, NOTICE_MS, 'info', { label: '보기', run: () => openMail({ tab: 'in' }) });
  }, NOTICE_GATHER_MS);
}

// ?mail=은 한 번만 (StrictMode가 효과를 두 번 돌려도)
let opened = false;

export function useMailReceiver(): void {
  useMailWatch(noticeNew);
  const uid = useSession((s) => s.user?.uid);

  // 푸시 알림을 눌러 연 앱 (로그인한 뒤에만 그려지므로 로그인 화면을 거쳐 와도 주소의 ?mail=는 남아 있다)
  useEffect(() => {
    if (!uid || opened) return;
    const id = mailParamOf(window.location.search);
    if (!id) return;
    opened = true;
    history.replaceState(history.state, '', stripMailParam(window.location.href));
    openMail({ id });
  }, [uid]);

  // 열린 앱 창에서 알림을 누름
  useEffect(() => {
    const sw = navigator.serviceWorker;
    if (!sw) return;
    const onMessage = (e: MessageEvent) => {
      const m = e.data as { type?: string; id?: unknown } | null;
      if (m?.type !== 'sp5-open-mail') return;
      const id = typeof m.id === 'string' && /^[A-Za-z0-9]{1,40}$/.test(m.id) ? m.id : undefined;
      openMail(id ? { id } : { tab: 'in' });
    };
    sw.addEventListener('message', onMessage);
    return () => sw.removeEventListener('message', onMessage);
  }, []);
}
