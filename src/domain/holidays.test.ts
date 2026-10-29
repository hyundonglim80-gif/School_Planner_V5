// 공휴일 이름 - 개인 → 공유 → 고정, 서버 문서 읽기
import { describe, expect, it } from 'vitest';
import { holidayNameIn, holidayYearsToWarn, parseRestDeInfo, readHolidayDoc } from './holidays';

const ok = (items: unknown) => ({ response: { header: { resultCode: '00', resultMsg: 'NORMAL SERVICE.' }, body: { items } } });

describe('공휴일', () => {
  it('개인 → 공유 → 고정 공휴일 차례', () => {
    const shared = { '2026-10-05': '추석 연휴', '2026-10-03': '개천절' };
    expect(holidayNameIn('2026-10-05', shared)).toBe('추석 연휴');
    expect(holidayNameIn('2026-10-05', shared, { '2026-10-05': '우리 휴일' })).toBe('우리 휴일');
    expect(holidayNameIn('2027-10-09', {})).toBe('한글날');
    expect(holidayNameIn('2026-10-07', shared)).toBeUndefined();
  });

  it('서버 문서: 그 해 날짜와 글만', () => {
    expect(readHolidayDoc(2026, { days: { '2026-01-01': ' 1월1일 ', '2025-12-25': '성탄절', '2026-02-xx': 'x', '2026-03-01': 3 } })).toEqual({ '2026-01-01': '1월1일' });
    expect(readHolidayDoc(2026, null)).toEqual({});
  });

  it('특일정보 한 달 응답: 쉬는 날만, item 하나·빈 달, 같은 날 둘은 잇기', () => {
    const feb = ok({
      item: [
        { dateKind: '01', dateName: '설날', isHoliday: 'Y', locdate: 20270207, seq: 1 },
        { dateKind: '01', dateName: '대체공휴일', isHoliday: 'Y', locdate: 20270209, seq: 1 },
        { dateKind: '01', dateName: '쉬지 않는 날', isHoliday: 'N', locdate: 20270210, seq: 1 },
      ],
    });
    expect(parseRestDeInfo(feb)).toEqual({ '2027-02-07': '설날', '2027-02-09': '대체공휴일' });
    expect(parseRestDeInfo(ok({ item: { dateName: '현충일', isHoliday: 'Y', locdate: 20270606 } }))).toEqual({ '2027-06-06': '현충일' });
    expect(parseRestDeInfo(ok(''))).toEqual({});
    const may = ok({
      item: [
        { dateName: '어린이날', isHoliday: 'Y', locdate: 20250505 },
        { dateName: '부처님오신날', isHoliday: 'Y', locdate: 20250505 },
      ],
    });
    expect(parseRestDeInfo(may)).toEqual({ '2025-05-05': '어린이날·부처님오신날' });
  });

  it('표가 있어야 하는 해: 올해, 9/1부터 내년도', () => {
    expect(holidayYearsToWarn('2026-08-31')).toEqual([2026]);
    expect(holidayYearsToWarn('2026-09-01')).toEqual([2026, 2027]);
    expect(holidayYearsToWarn('2026-12-31')).toEqual([2026, 2027]);
    expect(holidayYearsToWarn('2027-01-01')).toEqual([2027]);
  });

  it('특일정보 오류 응답은 던진다 (그 달 실패)', () => {
    const badKey = { OpenAPI_ServiceResponse: { cmmMsgHeader: { errMsg: 'SERVICE_KEY_IS_NOT_REGISTERED_ERROR', returnReasonCode: '30' } } };
    expect(() => parseRestDeInfo(badKey)).toThrow('SERVICE_KEY_IS_NOT_REGISTERED_ERROR');
    expect(() => parseRestDeInfo({ response: { header: { resultCode: '22', resultMsg: 'LIMITED NUMBER OF SERVICE REQUESTS EXCEEDS ERROR' } } })).toThrow('LIMITED');
    expect(() => parseRestDeInfo(null)).toThrow();
  });
});
