// 👥 공유 그룹 창 (V4 GroupModal - MENU 2-2: 계정 칸 '👥 공유 그룹'·공간 고르기 끝 '👥 그룹 관리…', 단축키 'group'). P8-4.
// 내 그룹(초대 코드·구성원·열기·나가기/지우기) · 새 그룹 만들기 · 초대 코드로 참여. V4 그룹 자료 가져오기는 아래 칸(■2).
import { useEffect, useState } from 'react';
import { showErrorToast, showToast, ShownError } from '../../app/toast';
import type { WindowProps } from '../../app/windows';
import { useSession } from '../../data/session';
import { setSpaceChoice, useMySpaces, type GroupSpace } from '../../data/spaceChoice';
import { createGroup, deleteGroup, joinGroup, leaveGroup, readPeople, writeMyName } from '../../data/spaces';
import { useCurrentSpaceId } from '../../data/session';
import ModalShell, { ModalCloseButton } from '../../ui/ModalShell';
import { Section } from '../settings/parts';

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

function GroupRow({ group, uid, current }: { group: GroupSpace; uid: string; current: boolean }) {
  const user = useSession((s) => s.user);
  const [people, setPeople] = useState<Record<string, { name: string }>>({});
  const [busy, setBusy] = useState('');
  const owner = group.ownerId === uid;
  const memberIds = Object.keys(group.members);
  const membersKey = memberIds.join(',');

  useEffect(() => {
    let alive = true;
    readPeople(group.id)
      .then((p) => {
        if (!alive) return;
        setPeople(p);
        // 예전에 들어와 이름이 없으면 지금 적는다
        if (user && !p[user.uid]) void writeMyName(group.id, user).catch(() => {});
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [group.id, membersKey, user]);

  const copy = async () => {
    if (!group.inviteCode) return;
    try {
      await navigator.clipboard.writeText(group.inviteCode);
      showToast(`📋 초대 코드 ${group.inviteCode}를 복사했습니다.`);
    } catch {
      showToast(`초대 코드: ${group.inviteCode}`);
    }
  };
  const leave = async () => {
    if (!user || !window.confirm(`[${group.name}] 그룹에서 나갈까요? 그룹 자료는 남고, 다시 들어오려면 초대 코드가 필요합니다.`)) return;
    setBusy('나가는 중…');
    try {
      await leaveGroup(user, group);
      if (current) setSpaceChoice(user.uid, null);
      showToast(`👋 [${group.name}] 그룹에서 나왔습니다.`);
    } catch (e) {
      showErrorToast(errText(e), e);
    } finally {
      setBusy('');
    }
  };
  const remove = async () => {
    if (!user || !window.confirm(`[${group.name}] 그룹을 지울까요?\n\n그룹의 일정·수업·기록·메모·조사표가 모두 영구히 지워지고, 구성원 모두 볼 수 없게 됩니다. 되돌릴 수 없습니다.`)) return;
    setBusy('지우는 중…');
    try {
      await deleteGroup(user, group, setBusy);
      if (current) setSpaceChoice(user.uid, null);
      showToast(`🗑️ [${group.name}] 그룹을 지웠습니다.`);
    } catch (e) {
      showErrorToast(`그룹을 다 지우지 못했습니다. 다시 눌러 주세요. ${errText(e)}`, e);
    } finally {
      setBusy('');
    }
  };

  return (
    <li data-group-row={group.id} className={`rounded-xl border p-3 space-y-1.5 ${current ? 'border-primary bg-primary/5' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-center gap-2">
        <span className="text-sm font-black text-slate-800 truncate">👥 {group.name}</span>
        <span data-group-role={owner ? 'owner' : 'member'} className="text-2xs font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
          {owner ? '그룹장' : '구성원'}
        </span>
        {current ? (
          <span className="ml-auto text-2xs font-bold text-primary">지금 보는 공간</span>
        ) : (
          <button
            type="button"
            data-group-open
            onClick={() => user && setSpaceChoice(user.uid, group.id)}
            className="ml-auto px-2.5 py-1 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary/90 cursor-pointer"
          >
            이 공간 보기
          </button>
        )}
      </div>
      <p data-group-members={memberIds.length} className="text-xs text-slate-500">
        구성원 {memberIds.length}명: {memberIds.map((id) => people[id]?.name || (id === uid ? '나' : '이름 없음')).join(', ')}
      </p>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {group.inviteCode && (
          <>
            <span className="text-slate-500">초대 코드</span>
            <b data-group-code-text className="font-mono tracking-widest text-slate-800">
              {group.inviteCode}
            </b>
            <button type="button" data-group-copy onClick={() => void copy()} className="px-2 py-0.5 rounded border border-slate-300 font-bold hover:bg-slate-50 cursor-pointer">
              코드 복사
            </button>
          </>
        )}
        <span className="ml-auto" />
        {owner ? (
          <button type="button" data-group-delete disabled={!!busy} onClick={() => void remove()} className="px-2 py-0.5 rounded border border-red-200 text-red-600 font-bold hover:bg-red-50 disabled:opacity-50 cursor-pointer">
            {busy || '그룹 지우기'}
          </button>
        ) : (
          <button type="button" data-group-leave disabled={!!busy} onClick={() => void leave()} className="px-2 py-0.5 rounded border border-slate-300 text-slate-600 font-bold hover:bg-slate-50 disabled:opacity-50 cursor-pointer">
            {busy || '나가기'}
          </button>
        )}
      </div>
    </li>
  );
}

export default function GroupsWindow({ close, raise }: WindowProps) {
  const user = useSession((s) => s.user);
  const { groups, loaded } = useMySpaces();
  const current = useCurrentSpaceId();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'' | 'create' | 'join'>('');

  const create = async () => {
    if (!user || busy) return;
    setBusy('create');
    try {
      const sid = await createGroup(user, name);
      setName('');
      setSpaceChoice(user.uid, sid);
      showToast('👥 그룹을 만들었습니다. 초대 코드를 동료에게 보내 주세요.');
    } catch (e) {
      if (!(e instanceof ShownError)) showErrorToast(errText(e), e);
    } finally {
      setBusy('');
    }
  };
  const join = async () => {
    if (!user || busy) return;
    setBusy('join');
    try {
      const sid = await joinGroup(user, code);
      setCode('');
      setSpaceChoice(user.uid, sid);
      showToast('👥 그룹에 들어왔습니다. 맨 위 📂 공간에서 개인 ↔ 그룹을 바꿉니다.');
    } catch (e) {
      if (!(e instanceof ShownError)) showErrorToast(errText(e), e);
    } finally {
      setBusy('');
    }
  };

  return (
    <ModalShell isOpen onClose={close} raise={raise} width="lg" title="👥 공유 그룹" bare footer={<ModalCloseButton onClose={close} />}>
      <div data-groups-window>
        <Section id="groups-mine" title="내 그룹" desc="그룹 공간을 고르면 모든 화면이 그 공간의 일정·수업·기록·메모·조사표를 보여 줍니다. 명렬표·출석부·학생 사진은 개인 공간에만 있습니다.">
          {!loaded ? (
            <p className="text-xs text-slate-400">불러오는 중…</p>
          ) : groups.length === 0 ? (
            <p data-groups-empty className="text-xs text-slate-500">
              아직 든 그룹이 없습니다. 아래에서 만들거나 초대 코드로 참여합니다.
            </p>
          ) : (
            <ul className="space-y-2">
              {groups.map((g) => (
                <GroupRow key={g.id} group={g} uid={user?.uid ?? ''} current={g.id === current} />
              ))}
            </ul>
          )}
        </Section>
        <Section id="groups-create" title="그룹 만들기" desc="만들면 6자리 초대 코드가 나옵니다. 그룹에는 처음에 기본 라벨이 들어갑니다(라벨은 그룹 것 - 구성원이 같은 목록을 봅니다).">
          <div className="flex gap-2">
            <input
              data-group-new-name
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void create()}
              placeholder="예: 4학년 협의회"
              className="flex-1 min-w-0 px-3 py-2 border border-slate-200 rounded-xl text-sm"
            />
            <button type="button" data-group-create disabled={!!busy || !name.trim()} onClick={() => void create()} className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold disabled:opacity-50 cursor-pointer">
              {busy === 'create' ? '만드는 중…' : '만들기'}
            </button>
          </div>
        </Section>
        <Section id="groups-join" title="초대 코드로 참여" desc="동료에게 받은 6자리 코드를 넣습니다.">
          <div className="flex gap-2">
            <input
              data-group-join-code
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && void join()}
              placeholder="ABC123"
              maxLength={12}
              className="flex-1 min-w-0 px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono tracking-widest"
            />
            <button type="button" data-group-join disabled={!!busy || !code.trim()} onClick={() => void join()} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold disabled:opacity-50 cursor-pointer">
              {busy === 'join' ? '참여하는 중…' : '참여하기'}
            </button>
          </div>
        </Section>
      </div>
    </ModalShell>
  );
}
