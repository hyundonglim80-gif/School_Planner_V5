// 메모 칸 안 '이어서 요청' 글 칸 (P23 - 10-20 #69 '🤖 다시 요청'을 바꿈). 스크롤 칸 밖이라 메모가 길어도 늘 보인다.
//   대화 글 칸(chat/ChatComposer) 그대로 - Enter·한글 짜기·쓰던 글 보관이 같고, 첨부만 끈다(글은 공개 이슈로 올라간다).
//   - 메모 글은 가지 않는다: 저장하지 않아도 보낸다. Ctrl+S는 메모 저장이지 보내기가 아니다(쓰는 칸 틀이 받는다).
//   - 앞 요청이 끝나기 전(배포 중까지 - 함수가 받지 않는다)에는 쓰기만 되고 보내지 못한다.
//   - 쓰던 글은 이 기기에('claude:<메모 id>' - 앱 위 '저장하지 않은 글' 띠에는 들지 않는다), 칸을 다시 열면 채운다.
import type { Ref } from 'react';
import { CLAUDE_FOLLOW_MAX } from '../../domain/claudeRequest';
import ChatComposer, { type ChatComposerHandle } from '../chat/ChatComposer';
import type { ItemDoc } from '../events/eventOps';
import { askClaudeMore } from './actions';

interface Props {
  ref?: Ref<ChatComposerHandle>;
  sid: string;
  item: ItemDoc;
  busy: boolean;
}

export default function ClaudeFollowBox({ ref, sid, item, busy }: Props) {
  return (
    <div data-claude-follow={busy ? 'hold' : 'ready'}>
      <ChatComposer
        ref={ref}
        roomKey={item.id}
        draftKey={`claude:${item.id}`}
        noAttach
        maxText={CLAUDE_FOLLOW_MAX}
        label="이어서 요청"
        hold={busy ? '앞 요청이 끝나면 보낼 수 있습니다' : null}
        hint="공개 이슈로 올라갑니다 - 학생 이름은 적지 마세요"
        onSend={(text) => askClaudeMore(sid, item, text)}
      />
    </div>
  );
}
