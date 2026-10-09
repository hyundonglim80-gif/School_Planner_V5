// 학생 사진 이름 규칙 (V4 lib/studentPhotoNames.ts 그대로 + 드라이브를 훑은 결과 모양 PhotoScan - data/google/studentPhotos가 채운다).
//
// 학생 사진의 폴더·파일 이름 규칙. 드라이브를 부르지 않는 순수한 셈만 둔다
// (그래야 테스트로 규칙을 못 박아 둘 수 있다).
//
//   폴더  School_Planner_Students_Poto / 2026-3-2
//   파일  2026-3-2-8-배유나.png        (학년도-학년-반-번호-이름)
//
// ⚠️ 번호를 이름에 넣기로 한 것에는 한 가지 값이 따라온다. 학기 중에 전입생이
//    들어오면 뒷번호가 한 칸씩 밀린다. 그러면 파일 이름의 번호와 명단의 번호가
//    어긋나 사진이 통째로 사라져 보인다.
//    그래서 찾을 때는 두 번 찾는다. 먼저 번호가 든 이름으로 찾고, 없으면
//    번호를 뺀 '2026-3-2-배유나'로 한 번 더 찾는다. 번호가 밀려도 이름만
//    같으면 사진이 남고, 예전에 번호 없이 올려 둔 사진도 그대로 보인다.
//    올릴 때는 늘 번호를 넣은 이름으로 올린다.

export const PHOTO_ROOT_FOLDER_NAME = 'School_Planner_Students_Poto';

/**
 * 드라이브에서 사진으로 받아들일 확장자.
 *
 * 차례가 뜻을 갖는다. 같은 학생의 사진이 확장자만 달리 여럿 있을 때 앞엣것을
 * 고른다. 앱이 올린 것은 webp라(줄여서 올린다) 그것을 먼저 본다.
 */
export const PHOTO_EXTENSIONS = ['webp', 'png', 'jpg', 'jpeg'] as const;

export interface ClassKey {
  year: number | string;
  grade: string;
  classNum: string;
}

/** V5 학급(학년·반 숫자) → 사진 이름 규칙의 학급 열쇠 */
export const photoClassKey = (c: { year: number; grade: number; num: number }): ClassKey => ({ year: c.year, grade: String(c.grade), classNum: String(c.num) });

/** '2026-3-1' — 학급 하나의 폴더 이름 */
export function classFolderName(cls: ClassKey): string {
  return `${cls.year}-${cls.grade}-${cls.classNum}`;
}

/**
 * 번호를 두 자리로 맞춘다. 5 -> '05'
 *
 * 파일 이름의 번호는 두 자리로 적는다(2026-3-1-05-홍길동.png). 그래야
 * 드라이브의 파일 목록이 번호 차례로 정렬된다. 한 자리로 적으면 10번이
 * 2번 앞에 온다. 명단에는 숫자 5로 들어 있으므로 여기서 맞춰 준다.
 * 세 자리가 넘는 번호는 그대로 둔다(한 반에 그럴 일은 없지만).
 */
export function padNum(num: number | string): string {
  return String(num).padStart(2, '0');
}

/** '2026-3-1-05-홍길동' — 올릴 때 쓰는, 확장자 없는 이름 */
export function photoBaseName(cls: ClassKey, num: number | string, name: string): string {
  return `${classFolderName(cls)}-${padNum(num)}-${normalizeName(name)}`;
}

/** 올릴 파일의 온전한 이름. 원본 확장자를 따르되 아는 것이 아니면 png로 둔다. */
export function photoFileName(
  cls: ClassKey,
  num: number | string,
  name: string,
  originalFileName: string
): string {
  const ext = extensionOf(originalFileName);
  const safe = (PHOTO_EXTENSIONS as readonly string[]).includes(ext) ? ext : 'png';
  return `${photoBaseName(cls, num, name)}.${safe}`;
}

/** 파일 이름에서 확장자만 소문자로. 없으면 빈 문자열. */
export function extensionOf(fileName: string): string {
  const at = fileName.lastIndexOf('.');
  return at < 0 ? '' : fileName.slice(at + 1).toLowerCase();
}

/** 확장자를 뗀 이름 */
export function stripExtension(fileName: string): string {
  const at = fileName.lastIndexOf('.');
  return at < 0 ? fileName : fileName.slice(0, at);
}

/** 사진으로 볼 파일인가 */
export function isPhotoFile(fileName: string): boolean {
  return (PHOTO_EXTENSIONS as readonly string[]).includes(extensionOf(fileName));
}

/**
 * 견줄 때 쓰는 이름 다듬기.
 *
 * 사람이 손으로 올린 파일에는 공백이 섞이기 쉽다('배 유나.png'). 견줄 때만
 * 공백을 걷어내고, 대소문자도 맞춘다(영문 이름 학생).
 */
export function normalizeName(name: string): string {
  return (name || '').replace(/\s+/g, '').toLowerCase();
}

export interface PhotoCandidate {
  /** 드라이브 파일 id */
  id: string;
  /** 드라이브에 적힌 파일 이름 */
  name: string;
}

export interface MatchedPhoto {
  id: string;
  name: string;
  /** 번호까지 맞았는가. 아니면 이름만으로 되찾은 것이다. */
  exact: boolean;
}

/**
 * 한 학생의 사진을 폴더 목록에서 찾는다.
 *
 * 1) 번호까지 맞는 것  2) 없으면 이름만 맞는 것
 * 확장자는 PHOTO_EXTENSIONS 순서를 따른다(png를 jpg보다 먼저 고른다).
 * 어느 쪽도 없으면 null.
 */
export function findPhotoFor(
  files: PhotoCandidate[],
  cls: ClassKey,
  num: number | string,
  name: string
): MatchedPhoto | null {
  const wantName = normalizeName(name);
  if (!wantName) return null;

  const prefix = classFolderName(cls);
  // 번호는 두 자리로 적는 것이 약속이지만, 손으로 붙인 이름은 한 자리인
  // 경우가 있다. 둘 다 받아들인다.
  const padded = `${prefix}-${padNum(num)}-${wantName}`;
  const plain = `${prefix}-${num}-${wantName}`;
  const withoutNum = `${prefix}-${wantName}`;

  const exact = pickByBase(files, padded) || (plain !== padded ? pickByBase(files, plain) : null);
  if (exact) return { ...exact, exact: true };

  const loose = pickByBase(files, withoutNum);
  return loose ? { ...loose, exact: false } : null;
}

function pickByBase(files: PhotoCandidate[], base: string): PhotoCandidate | null {
  const hits = files.filter(
    (f) => isPhotoFile(f.name) && normalizeName(stripExtension(f.name)) === base
  );
  if (hits.length === 0) return null;
  // 같은 이름이 확장자만 달리 여럿 있으면 정해진 차례로 하나를 고른다.
  // (그렇지 않으면 드라이브가 주는 차례에 따라 사진이 오락가락한다)
  hits.sort(
    (a, b) =>
      (PHOTO_EXTENSIONS as readonly string[]).indexOf(extensionOf(a.name)) -
      (PHOTO_EXTENSIONS as readonly string[]).indexOf(extensionOf(b.name))
  );
  return hits[0];
}

/**
 * 학급 전체의 사진을 한 번에 맞춘다.
 * 돌려주는 열쇠는 학생의 번호다(명단 안에서는 번호가 겹치지 않는다).
 */
export function matchClassPhotos(
  files: PhotoCandidate[],
  cls: ClassKey,
  students: { num: number; name: string }[]
): Map<number, MatchedPhoto> {
  const out = new Map<number, MatchedPhoto>();
  for (const st of students) {
    const hit = findPhotoFor(files, cls, st.num, st.name);
    if (hit) out.set(st.num, hit);
  }
  return out;
}

// ── 드라이브를 훑은 결과 (data/google/studentPhotos가 채우고 photoDiagnosis가 읽는다) ──

export interface DrivePhotoFile extends PhotoCandidate {
  /** 마지막으로 고쳐진 때. 재어 둔 사진을 언제 버릴지 가르는 값이다. */
  modifiedTime?: string;
}

export interface PhotoScan {
  /** 사진을 찾아낸 폴더. 못 찾았으면 null */
  folderId: string | null;
  /**
   * 어디서 찾았는가.
   *   managed   School_Planner/Students_Poto/2026-3-1 (앱이 맡아 두는 자리)
   *   picked    학급을 위해 따로 골라 둔 폴더
   *   subfolder 따로 고른 위쪽 폴더 아래의 '2026-3-1'
   *   root      따로 고른 위쪽 폴더 자체
   *   none      못 찾음
   */
  source: 'managed' | 'picked' | 'subfolder' | 'root' | 'none';
  files: DrivePhotoFile[];
  /** 뿌리 폴더 안에서 본 하위 폴더 이름들 (없으면 빈 배열) */
  subfolderNames: string[];
  /** 뿌리 폴더 안이 통째로 비어 보이는가 */
  rootEmpty: boolean;
  /**
   * 사진을 찾은 폴더 안에서 앱 눈에 보인 것의 총 개수 (사진이 아닌 것 포함).
   *
   * 0이면 폴더가 정말 비었거나, 앱에 안 보이거나 둘 중 하나다. 0이 아닌데
   * 사진이 0장이면 확장자나 이름 문제다. 이 둘을 가리려고 세어 둔다.
   */
  itemCount: number;
  /**
   * 학급 폴더는 눈에 보이는데 그 안이 비어 보이는가.
   *
   * 사진을 안 올린 것일 수도 있고, 권한이 손자까지 닿지 않아 안 보이는 것일
   * 수도 있다. 여기서는 가릴 수 없으므로 표시만 남기고 화면에서 둘 다 말한다.
   */
  classFolderLooksEmpty: boolean;
}
