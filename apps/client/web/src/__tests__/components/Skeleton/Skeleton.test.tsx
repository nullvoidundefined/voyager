import { render } from '@testing-library/react';

import { Skeleton } from '@/components/Skeleton/Skeleton';

describe('Skeleton', () => {
  it('renders with aria-hidden so screen readers skip it', () => {
    const { container } = render(<Skeleton width='100%' height={20} />);
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('applies width and height from props', () => {
    const { container } = render(<Skeleton width={200} height={40} />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.width).toBe('200px');
    expect(el.style.height).toBe('40px');
  });
});
