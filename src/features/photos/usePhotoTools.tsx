// 학생 사진을 쓰는 화면(명렬표 관리·학급 화면)의 공통 손잡이 (V4 RosterModal·ClassScreen의 사진 부분을 한 곳으로).
//   usePhotoTools(학급, 학생, 켬) = useStudentPhotos + 누르는 일(켜기·로그인·폴더 고르기·여러 장·드라이브·크게 보기)·여러 장 결과.
//   그리는 부품은 PhotoParts.tsx.
import { useMemo, useState } from 'react';
import { showErrorToast, showToast } from '../../app/toast';
import { openManagedPhotoFolder } from '../../data/google/studentPhotos';
import { diagnosePhotos } from '../../domain/photoDiagnosis';
import { classFolderName, photoClassKey } from '../../domain/studentPhotoNames';
import { closeImageViewer, openImageViewer } from '../../ui/imageViewer';
import { formatBytes } from '../../ui/imageShrink';
import { pickManyPhotosFromDrive, pickStudentPhotoFromDrive } from './drivePhotoPick';
import PhotoReplaceButtons from './PhotoReplaceButtons';
import { useStudentPhotos } from './useStudentPhotos';

export interface PhotoStudent {
  num: number;
  name: string;
}

export interface BulkReport {
  picked: number;
  uploaded: number;
  /** 번호 없이 이름만 보고 짝지은 것 */
  weak: string[];
  unmatched: string[];
  notPhotos: string[];
  duplicates: string[];
  failed: string[];
  /** '12.4MB → 1.1MB' */
  saved: string;
}

const messageOf = (e: unknown, fallback: string) => (e as Error)?.message || fallback;

/** 이 기기에 남기는 사진 보기 켬/끔 */
export function readOn(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}
export function writeOn(key: string, on: boolean) {
  try {
    localStorage.setItem(key, on ? '1' : '0');
  } catch {
    // 시크릿 모드 등 - 이번 판에서만
  }
}

export function usePhotoTools(cls: { year: number; grade: number; num: number } | null, students: readonly PhotoStudent[], enabled: boolean) {
  // 학급 열쇠는 숫자 셋이 같으면 같은 것 (그릴 때마다 새 객체면 사진 훅이 다시 읽는다)
  const year = cls?.year;
  const grade = cls?.grade;
  const num = cls?.num;
  const key = useMemo(() => (year && grade && num ? photoClassKey({ year, grade, num }) : null), [year, grade, num]);
  const photos = useStudentPhotos(key, students as PhotoStudent[], enabled);
  const [report, setReport] = useState<BulkReport | null>(null);
  const [driveFetching, setDriveFetching] = useState<{ done: number; total: number } | null>(null);

  const authorize = () => photos.authorize().catch((e) => showErrorToast(messageOf(e, '사진을 불러오지 못했습니다.')));

  const upload = async (student: PhotoStudent, file: File) => {
    try {
      await photos.upload(student, file);
      showToast(`✅ ${student.name || `${student.num}번`} 사진을 올렸습니다.`);
    } catch (e) {
      showErrorToast(messageOf(e, '사진을 올리지 못했습니다.'));
    }
  };
  const pickDrive = (student: PhotoStudent) => pickStudentPhotoFromDrive(student, (file) => upload(student, file));

  const bulkUpload = async (list: FileList | File[] | null) => {
    const files = Array.from(list || []);
    if (files.length === 0) return showErrorToast('고른 파일이 없습니다.');
    setReport(null);
    try {
      const { plan, failed, before, after } = await photos.uploadMany(files);
      const uploaded = plan.matched.length - failed.length;
      setReport({
        picked: files.length,
        uploaded,
        weak: plan.matched.filter((m) => m.by !== 'numAndName').map((m) => `${m.student.num}번 ${m.student.name} ← ${m.file.name}`),
        unmatched: plan.unmatched.map((f) => f.name),
        notPhotos: plan.notPhotos.map((f) => f.name),
        duplicates: plan.duplicates.map((f) => f.name),
        failed,
        saved: before > after ? `${formatBytes(before)} → ${formatBytes(after)}` : '',
      });
      if (uploaded > 0) showToast(`✅ 사진 ${uploaded}장을 올렸습니다.`);
    } catch (e) {
      showErrorToast(messageOf(e, '사진을 올리지 못했습니다.'));
    }
  };
  const bulkFromDrive = async () => {
    const files = await pickManyPhotosFromDrive((done, total) => setDriveFetching(done < total ? { done, total } : null));
    setDriveFetching(null);
    if (files.length > 0) await bulkUpload(files);
  };

  const pickClassFolder = async () => {
    try {
      const picked = await photos.connectForClass();
      if (picked && key) showToast(`✅ ${classFolderName(key)} 사진을 '${picked.name}' 폴더에서 읽습니다.`);
    } catch (e) {
      showErrorToast(messageOf(e, '폴더를 연결하지 못했습니다.'));
    }
  };
  const forgetClassFolder = async () => {
    try {
      await photos.forgetClassFolder();
      showToast('✅ 앱이 맡아 두는 사진 폴더를 다시 씁니다.');
    } catch (e) {
      showErrorToast(messageOf(e, '되돌리지 못했습니다.'));
    }
  };
  const openPickedFolder = () => {
    const id = photos.classFolder?.id || photos.scan?.folderId;
    if (!id) return showErrorToast('열어 볼 폴더가 없습니다.');
    window.open(`https://drive.google.com/drive/folders/${id}`, '_blank');
  };
  /** 아래 '사진 폴더' - 이 학급에 고른 폴더, 없으면 앱이 맡아 두는 School_Planner/Students_Poto/2026-3-1 (없으면 만든다) */
  const openPhotoFolder = async () => {
    if (photos.classFolder) return void window.open(`https://drive.google.com/drive/folders/${photos.classFolder.id}`, '_blank');
    if (!key) return;
    try {
      window.open(await openManagedPhotoFolder(key), '_blank');
    } catch (e) {
      showErrorToast(messageOf(e, '폴더를 열지 못했습니다.'));
    }
  };

  /** 사진을 크게 (사진 크기와 상관없이 같은 세로 틀) - 아래에서 바꾸기 */
  const openViewer = (student: PhotoStudent, url: string) =>
    openImageViewer([{ url, name: `${student.num}번 ${student.name}` }], 0, {
      frame: 'portrait',
      footer: (
        <PhotoReplaceButtons
          busy={photos.uploading === student.num}
          onFile={async (file) => {
            await upload(student, file);
            closeImageViewer();
          }}
          onDrive={async () => {
            if (await pickDrive(student)) closeImageViewer();
          }}
        />
      ),
    });

  const diagnosis =
    key &&
    diagnosePhotos({
      scan: photos.scan,
      className: classFolderName(key),
      studentCount: students.length,
      matchedCount: students.length - photos.missing.length,
      hasLegacyRoot: !!photos.folders.root,
      pickedFolderName: photos.classFolder?.name,
    });
  const where = photos.classFolder ? `고른 폴더 : ${photos.classFolder.name}` : photos.folder && key ? `${photos.folder.name} / ${classFolderName(key)}` : undefined;

  return {
    photos,
    report,
    clearReport: () => setReport(null),
    driveFetching,
    authorize,
    upload,
    pickDrive,
    bulkUpload,
    bulkFromDrive,
    pickClassFolder,
    forgetClassFolder,
    openPickedFolder,
    openPhotoFolder,
    openViewer,
    diagnosis: diagnosis || null,
    where,
  };
}

export type PhotoTools = ReturnType<typeof usePhotoTools>;
