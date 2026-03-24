import { amadeusGet } from "app/services/amadeus.service.js";
import { cacheGet, cacheSet, normalizeCacheKey } from "app/services/cache.service.js";
import { logger } from "app/utils/logs/logger.js";

const CACHE_TTL = 3600;

export interface HotelSearchInput {
  city_code: string;
  check_in: string;
  check_out: string;
  guests: number;
  star_rating_min?: number;
  max_price_per_night?: number;
}

export interface HotelResult {
  hotel_id: string;
  offer_id: string;
  name: string;
  address: string;
  city: string;
  star_rating: number;
  total_price: number;
  price_per_night: number;
  currency: string;
  check_in: string;
  check_out: string;
}

interface AmadeusHotelOffer {
  hotel: {
    hotelId: string;
    name: string;
    rating: string;
    address: { lines: string[]; cityName: string };
  };
  offers: Array<{
    id: string;
    price: { total: string; currency: string };
    checkInDate: string;
    checkOutDate: string;
  }>;
}

function normalizeHotel(entry: AmadeusHotelOffer): HotelResult | null {
  const offer = entry.offers[0];
  if (!offer) return null;

  const totalPrice = parseFloat(offer.price.total);
  const checkIn = new Date(offer.checkInDate);
  const checkOut = new Date(offer.checkOutDate);
  const nights = Math.max(
    1,
    Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)),
  );

  return {
    hotel_id: entry.hotel.hotelId,
    offer_id: offer.id,
    name: entry.hotel.name,
    address: entry.hotel.address.lines.join(", "),
    city: entry.hotel.address.cityName,
    star_rating: parseInt(entry.hotel.rating) || 0,
    total_price: totalPrice,
    price_per_night: Math.round((totalPrice / nights) * 100) / 100,
    currency: offer.price.currency,
    check_in: offer.checkInDate,
    check_out: offer.checkOutDate,
  };
}

export async function searchHotels(input: HotelSearchInput): Promise<HotelResult[]> {
  const cacheKey = normalizeCacheKey("amadeus", "hotel-offers", {
    cityCode: input.city_code,
    checkInDate: input.check_in,
    checkOutDate: input.check_out,
    adults: input.guests,
    ratings: input.star_rating_min,
  });

  const cached = await cacheGet<HotelResult[]>(cacheKey);
  if (cached) {
    logger.debug({ cacheKey }, "Hotel search cache hit");
    return cached;
  }

  const params: Record<string, string | number | undefined> = {
    cityCode: input.city_code,
    checkInDate: input.check_in,
    checkOutDate: input.check_out,
    adults: input.guests,
    ratings: input.star_rating_min,
  };

  const response = (await amadeusGet("/v3/shopping/hotel-offers", params)) as {
    data: AmadeusHotelOffer[];
  };

  const results = (response.data || [])
    .map(normalizeHotel)
    .filter((r): r is HotelResult => r !== null)
    .sort((a, b) => a.total_price - b.total_price);

  await cacheSet(cacheKey, results, CACHE_TTL);
  logger.info({ count: results.length, city: input.city_code }, "Hotel search complete");

  return results;
}
