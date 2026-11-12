// 관리자 탭 '관리자 계정' (P33-1 - 11-12 사용자 '세 계정을 관리자로, 필요하면 관리자를 더할 수 있게'). 셈은 domain/admins, 서버는 data/admins.
//   기본 셋은 🔒(뺄 수 없다) · 더한 관리자는 줄마다 빼기 · 메일 칸 + 더하기. 누르는 즉시 서버에 쓴다(환경설정의 다른 칸처럼 저장 단추 없음).
//   더한 계정은 다음에 앱을 열 때부터 관리자다(그 계정이 열어 둔 앱은 다시 열어야 한다).
import { useEffect, useState } from 'react';
import { showErrorToast, showToast } from '../../app/toast';
import { loadAdmins, updateAdmins } from '../../data/admins';
import { useSession } from '../../data/session';
import { ADD_ADMIN_REASON, addAdminEmail, BASE_ADMIN_EMAILS, normalizeAdminEmail, removeAdminEmail } from '../../domain/admins';
import { Section } from './parts';

const errText = (e: unknown) => String((e as { code?: string })?.code || (e as Error)?.message || e);

export default function AdminsSection() {
  const me = normalizeAdminEmail(useSession((s) => s.user?.email)) ?? '';
  const [list, setList] = useState<string[] | null>(null);
  const [failed, setFailed] = useState('');
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadAdmins()
      .then(setList)
      .catch((e) => setFailed(errText(e)));
  }, []);

  const add = async () => {
    const first = addAdminEmail(list ?? [], input);
    if (!first.ok) return showToast(ADD_ADMIN_REASON[first.reason]);
    setBusy(true);
    try {
      // 서버의 지금 목록에 더한다 - 그새 다른 관리자가 고쳤어도
      const got: { reason: keyof typeof ADD_ADMIN_REASON | null } = { reason: null };
      const next = await updateAdmins((cur) => {
        const r = addAdminEmail(cur, first.email);
        got.reason = r.ok ? null : r.reason;
        return r.ok ? r.list : cur;
      });
      setList(next);
      setInput('');
      if (got.reason) showToast(ADD_ADMIN_REASON[got.reason]);
      else showToast(`👑 ${first.email}을(를) 관리자로 더했습니다 - 그 계정이 다음에 앱을 열 때부터 관리자입니다.`);
    } catch (e) {
      showErrorToast(`관리자를 더하지 못했습니다 (${errText(e)}).`, e);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (email: string) => {
    const self = email === me;
    if (!window.confirm(self ? `나(${email})를 관리자에서 뺄까요?\n빼면 이 '관리자' 탭이 사라집니다.` : `${email}을(를) 관리자에서 뺄까요?`)) return;
    setBusy(true);
    try {
      const next = await updateAdmins((cur) => removeAdminEmail(cur, email));
      setList(next);
      showToast(`${email}을(를) 관리자에서 뺐습니다.`);
    } catch (e) {
      showErrorToast(`관리자를 빼지 못했습니다 (${errText(e)}).`, e);
    } finally {
      setBusy(false);
    }
  };

  const row = 'flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100';
  return (
    <Section
      id="admins"
      title="관리자 계정"
      desc="관리자는 이 '관리자' 탭(공휴일·오류 기록·관리자 계정)을 봅니다. 기본 관리자 셋은 늘 관리자이고, 더한 계정은 다음에 앱을 열 때부터 관리자입니다(메일 확인된 구글 계정)."
    >
      <div data-admins-section className="space-y-1.5">
        {BASE_ADMIN_EMAILS.map((email) => (
          <div key={email} data-admin-row={email} data-admin-base className={row}>
            <span className="text-xs font-bold text-slate-700 flex-1 min-w-0 truncate">{email}</span>
            <span className="text-[11px] text-slate-400 shrink-0" title="기본 관리자는 뺄 수 없습니다">
              🔒 기본
            </span>
          </div>
        ))}
        {list === null && !failed && <p className="text-xs text-slate-400">읽는 중…</p>}
        {failed && (
          <p data-admins-failed className="text-xs text-red-500">
            목록을 읽지 못했습니다 ({failed})
          </p>
        )}
        {list?.map((email) => (
          <div key={email} data-admin-row={email} className={row}>
            <span className="text-xs font-bold text-slate-700 flex-1 min-w-0 truncate">
              {email}
              {email === me && <span className="text-slate-400 font-normal"> (나)</span>}
            </span>
            <button
              type="button"
              data-admin-remove={email}
              disabled={busy}
              onClick={() => void remove(email)}
              className="px-2.5 py-1 shrink-0 bg-white border border-slate-200 hover:border-red-300 hover:text-red-600 text-slate-500 rounded-lg text-xs font-bold cursor-pointer disabled:opacity-40"
            >
              빼기
            </button>
          </div>
        ))}
      </div>
      {list !== null && (
        <form
          // 브라우저 메일 검사(말풍선)가 아니라 앱 안내로 - 같은 말(domain/admins ADD_ADMIN_REASON)
          noValidate
          className="flex gap-2 mt-3"
          onSubmit={(e) => {
            e.preventDefault();
            void add();
          }}
        >
          <input
            data-admin-email
            type="email"
            autoComplete="off"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="더할 관리자의 구글 메일"
            aria-label="더할 관리자의 구글 메일"
            className="flex-1 min-w-0 px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-primary"
          />
          <button
            type="submit"
            data-admin-add
            disabled={busy || !input.trim()}
            className="px-3 py-1.5 shrink-0 bg-primary hover:bg-primary/90 text-white rounded-lg text-xs font-bold cursor-pointer disabled:opacity-40"
          >
            + 더하기
          </button>
        </form>
      )}
    </Section>
  );
}
