import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import DecorBand from '../app/DecorBand';
import { useCommonSettings } from '../app/prefs';
import DecorSpot from './DecorSpot';
import type { DecorSlot } from './decorArt';

// 계정 설정 맞추기는 서버를 부른다 - 여기서는 store만
vi.mock('../data/settingsSync', () => ({ settingsPort: () => ({}), startSettingsSync: () => () => {} }));

const SLOTS: DecorSlot[] = ['events', 'journal', 'memo', 'search'];

afterEach(() => {
  vi.useRealTimers();
  useCommonSettings.setState({ decor: 'off' });
});

describe('꾸미기 그림', () => {
  it('끄면 빈 화면은 그 자리의 원래 모습, 머리줄 띠는 없다', () => {
    const spot = render(<DecorSpot slot="events" fallback={<span data-was>📋</span>} />);
    expect(spot.container.querySelector('[data-was]')).not.toBeNull();
    expect(spot.container.querySelector('svg')).toBeNull();
    expect(render(<DecorBand />).container.firstChild).toBeNull();
  });

  it('켜면 그림으로 바꾸고 원래 모습은 그리지 않는다 (그림은 켰을 때 나눠 받는다 - 받는 동안 같은 크기 빈자리)', async () => {
    useCommonSettings.setState({ decor: 'winter' });
    const { container } = render(<DecorSpot slot="events" fallback={<span data-was>📋</span>} />);
    expect(container.querySelector('[data-was]')).toBeNull();
    await waitFor(() => expect(container.querySelector('[data-decor-spot="winter"]')).not.toBeNull());
    expect(container.querySelector('[data-was]')).toBeNull();
  });

  it('모르는 값은 끄기로 그린다 (새 앱이 고른 꾸미기를 옛 앱이 받아도)', () => {
    useCommonSettings.setState({ decor: 'rainbow' });
    expect(render(<DecorBand />).container.firstChild).toBeNull();
  });

  it('동물은 자리마다 다른 동물', async () => {
    useCommonSettings.setState({ decor: 'animal' });
    const spots = SLOTS.map((slot) => render(<DecorSpot slot={slot} />).container);
    await waitFor(() => expect(spots.every((c) => c.querySelector('svg'))).toBe(true));
    const drawn = spots.map((c) => c.querySelector('svg')!.innerHTML);
    expect(new Set(drawn).size).toBe(SLOTS.length);
  });

  it('머리줄 띠는 누르기를 막지 않고 읽어 주지도 않는다', async () => {
    useCommonSettings.setState({ decor: 'spring' });
    const band = render(<DecorBand />).container.querySelector('[data-decor-band="spring"]')!;
    expect(band.getAttribute('aria-hidden')).toBe('true');
    expect(band.className).toContain('pointer-events-none');
    await waitFor(() => expect(band.querySelector('pattern path')).not.toBeNull());
  });

  it("'계절 따라'는 오늘 달의 그림", () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 6, 15));
    useCommonSettings.setState({ decor: 'season' });
    const { container } = render(<DecorBand />);
    expect(container.querySelector('[data-decor-band="summer"]')).not.toBeNull();
  });
});
