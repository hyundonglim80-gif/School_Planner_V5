// 나이스 개발자 키 (공유 설정 sharedConfig/neis - 로그인하면 읽기, 개발자만 쓰기 · V4와 같은 문서를 읽기만).
// data/neis는 Firebase를 모른다 - 여기서 읽는 법을 건다(features/school이 한 번 부른다).
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { setNeisKeySource } from './neis';

let installed = false;

export function installNeisKey() {
  if (installed) return;
  installed = true;
  setNeisKeySource(async () => {
    const snap = await getDoc(doc(db, 'sharedConfig', 'neis'));
    return snap.exists() ? String(snap.data()?.key || '') : '';
  });
}
