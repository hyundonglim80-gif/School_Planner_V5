import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App 껍데기', () => {
  it('SP5와 빌드 번호를 보인다', () => {
    const { container } = render(<App />);
    expect(screen.getByText('SP5')).toBeInTheDocument();
    expect(container.querySelector('[data-build-id]')).toHaveTextContent('빌드 test');
  });
});
