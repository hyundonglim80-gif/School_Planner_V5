// 출석부·알림장을 열 때 고를 학급 (V4 AttendanceDrawer의 학급 고르기) - 순수.
//   넘겨받은 학급 → (교과 + 담임) 담임반 → 학급 화면에서 고른 학급 → 그 날짜 학년도의, 학생이 있는 첫 학급 → 학생이 있는 첫 학급 → 첫 학급
import { classLabelOf, type RosterClass } from '../../domain/roster';

export function pickAttendanceClass<C extends RosterClass & { id: string }>(
  classes: readonly C[],
  opts: { classId?: string | null; homeroom?: string | null; remembered?: string | null; year: number },
): C | null {
  const withStudents = classes.filter((c) => c.students.length > 0);
  return (
    (opts.classId ? classes.find((c) => c.id === opts.classId) : undefined) ??
    (opts.homeroom ? classes.find((c) => c.year === opts.year && classLabelOf(c) === opts.homeroom) : undefined) ??
    (opts.remembered ? classes.find((c) => c.id === opts.remembered) : undefined) ??
    withStudents.find((c) => c.year === opts.year) ??
    withStudents[0] ??
    classes[0] ??
    null
  );
}
