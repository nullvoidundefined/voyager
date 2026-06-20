import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ExperienceCard } from '@/components/ChatBox/widgets/ExperienceCard';

afterEach(cleanup);

vi.mock('@/components/ChatBox/widgets/MapPreviewCard', () => ({
  MapPreviewCard: () => <div data-testid='map-preview' />,
}));

const allFieldsProps = {
  name: 'Temple of the Golden Pavilion',
  category: 'Cultural landmark',
  photoRef: 'abc123ref',
  rating: 4.7,
  estimatedCost: 1500,
  latitude: 35.0394,
  longitude: 135.7292,
  selected: false,
  onClick: vi.fn(),
};

describe('ExperienceCard', () => {
  describe('all fields populated', () => {
    it('renders name, category, rating, and cost', () => {
      render(<ExperienceCard {...allFieldsProps} />);

      expect(
        screen.getByText('Temple of the Golden Pavilion'),
      ).toBeInTheDocument();
      expect(screen.getByText('Cultural landmark')).toBeInTheDocument();
      expect(screen.getByText(/4\.7/)).toBeInTheDocument();
      expect(screen.getByText(/\$1,500/)).toBeInTheDocument();
    });

    it('renders the photo as an img element', () => {
      render(<ExperienceCard {...allFieldsProps} />);

      const img = screen.getByRole('img', {
        name: 'Temple of the Golden Pavilion',
      });
      expect(img).toBeInTheDocument();
      expect(img.getAttribute('src')).toContain('abc123ref');
    });

    it('renders the map preview when lat/lng are provided', () => {
      render(<ExperienceCard {...allFieldsProps} />);
      expect(screen.getByTestId('map-preview')).toBeInTheDocument();
    });
  });

  describe('nullable fields as null', () => {
    it('renders without crashing and shows only the name', () => {
      render(
        <ExperienceCard
          name='Mystery Spot'
          category={null}
          photoRef={null}
          rating={null}
          estimatedCost={null}
        />,
      );

      expect(screen.getByText('Mystery Spot')).toBeInTheDocument();
      expect(screen.queryByText('Cultural landmark')).not.toBeInTheDocument();
      expect(screen.queryByText(/★/)).not.toBeInTheDocument();
      expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
    });

    it('does not render an img when photoRef is null', () => {
      render(
        <ExperienceCard
          name='Mystery Spot'
          category={null}
          photoRef={null}
          rating={null}
          estimatedCost={null}
        />,
      );

      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });

    it('does not render the map preview when lat/lng are omitted', () => {
      render(
        <ExperienceCard
          name='Mystery Spot'
          category={null}
          photoRef={null}
          rating={null}
          estimatedCost={null}
        />,
      );

      expect(screen.queryByTestId('map-preview')).not.toBeInTheDocument();
    });
  });

  describe('selected state', () => {
    it('sets aria-pressed="true" when selected', () => {
      render(<ExperienceCard {...allFieldsProps} selected={true} />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-pressed', 'true');
    });

    it('sets aria-pressed="false" when unselected', () => {
      render(<ExperienceCard {...allFieldsProps} selected={false} />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-pressed', 'false');
    });

    it('defaults to aria-pressed="false" when selected prop is omitted', () => {
      render(
        <ExperienceCard
          name='Mystery Spot'
          category={null}
          photoRef={null}
          rating={null}
          estimatedCost={null}
        />,
      );

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-pressed', 'false');
    });
  });
});
