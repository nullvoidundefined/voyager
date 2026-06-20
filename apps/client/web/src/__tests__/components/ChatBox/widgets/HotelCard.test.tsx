import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HotelCard } from '@/components/ChatBox/widgets/HotelCard';

afterEach(cleanup);

vi.mock('@/components/ChatBox/widgets/MapPreviewCard', () => ({
  MapPreviewCard: () => <div data-testid='map-preview' />,
}));

const allFieldsProps = {
  name: 'Grand Hyatt Tokyo',
  city: 'Tokyo',
  imageUrl: 'https://example.com/hotel.jpg',
  starRating: 5,
  pricePerNight: 350,
  totalPrice: 2100,
  currency: 'USD',
  checkIn: '2026-07-01',
  checkOut: '2026-07-07',
  latitude: 35.6595,
  longitude: 139.7292,
  selected: false,
  onClick: vi.fn(),
};

describe('HotelCard', () => {
  describe('all fields populated', () => {
    it('renders name, city, star rating, and pricing', () => {
      render(<HotelCard {...allFieldsProps} />);

      expect(screen.getByText('Grand Hyatt Tokyo')).toBeInTheDocument();
      expect(screen.getByText('Tokyo')).toBeInTheDocument();
      expect(screen.getByText('★★★★★')).toBeInTheDocument();
      expect(screen.getByText(/\$350/)).toBeInTheDocument();
      expect(screen.getByText(/\$2,100 total/)).toBeInTheDocument();
    });

    it('renders the hotel image', () => {
      render(<HotelCard {...allFieldsProps} />);

      const img = screen.getByRole('img', { name: 'Grand Hyatt Tokyo' });
      expect(img).toBeInTheDocument();
      expect(img.getAttribute('src')).toBe('https://example.com/hotel.jpg');
    });

    it('renders check-in and check-out dates', () => {
      render(<HotelCard {...allFieldsProps} />);

      expect(screen.getByText(/Jul 1, 2026/)).toBeInTheDocument();
      expect(screen.getByText(/Jul 7, 2026/)).toBeInTheDocument();
    });

    it('renders the map preview when lat/lng are provided', () => {
      render(<HotelCard {...allFieldsProps} />);
      expect(screen.getByTestId('map-preview')).toBeInTheDocument();
    });
  });

  describe('nullable/optional fields as null', () => {
    it('renders without crashing when imageUrl and starRating are null', () => {
      render(
        <HotelCard {...allFieldsProps} imageUrl={null} starRating={null} />,
      );

      expect(screen.getByText('Grand Hyatt Tokyo')).toBeInTheDocument();
      expect(screen.getByText('Tokyo')).toBeInTheDocument();
      expect(screen.queryByText(/★/)).not.toBeInTheDocument();
    });

    it('does not render an img when imageUrl is null', () => {
      render(
        <HotelCard {...allFieldsProps} imageUrl={null} starRating={null} />,
      );

      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });

    it('does not render the map preview when lat/lng are omitted', () => {
      render(
        <HotelCard
          {...allFieldsProps}
          latitude={undefined}
          longitude={undefined}
        />,
      );

      expect(screen.queryByTestId('map-preview')).not.toBeInTheDocument();
    });
  });

  describe('missing prices (B21)', () => {
    it('shows "Price unavailable" instead of $0/night when pricePerNight is 0', () => {
      render(
        <HotelCard {...allFieldsProps} pricePerNight={0} totalPrice={0} />,
      );

      expect(screen.queryByText(/\$0/)).not.toBeInTheDocument();
      expect(screen.getByText(/price unavailable/i)).toBeInTheDocument();
    });

    it('hides the total line when totalPrice is 0', () => {
      render(
        <HotelCard {...allFieldsProps} pricePerNight={0} totalPrice={0} />,
      );

      expect(screen.queryByText(/total/i)).not.toBeInTheDocument();
    });

    it('still shows /night when pricePerNight is non-zero but totalPrice is 0', () => {
      render(
        <HotelCard {...allFieldsProps} pricePerNight={150} totalPrice={0} />,
      );

      expect(screen.getByText(/\$150/)).toBeInTheDocument();
      expect(screen.queryByText(/total/i)).not.toBeInTheDocument();
    });
  });

  describe('selected state', () => {
    it('sets aria-pressed="true" when selected', () => {
      render(<HotelCard {...allFieldsProps} selected={true} />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-pressed', 'true');
    });

    it('sets aria-pressed="false" when unselected', () => {
      render(<HotelCard {...allFieldsProps} selected={false} />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-pressed', 'false');
    });

    it('defaults to aria-pressed="false" when selected prop is omitted', () => {
      const { selected: _selected, ...rest } = allFieldsProps;
      render(<HotelCard {...rest} />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-pressed', 'false');
    });
  });
});
