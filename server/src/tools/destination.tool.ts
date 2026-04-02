export interface DestinationInput {
  city_name: string;
}

export interface DestinationResult {
  city_name: string;
  iata_code: string | null;
  country: string | null;
  timezone: string | null;
  currency: string | null;
  best_time_to_visit: string | null;
  error?: string;
}

interface CityData {
  iata_code: string;
  country: string;
  timezone: string;
  currency: string;
  best_time_to_visit: string;
}

const CITY_DATABASE: Record<string, CityData> = {
  'new york': {
    iata_code: 'JFK',
    country: 'United States',
    timezone: 'America/New_York',
    currency: 'USD',
    best_time_to_visit: 'April to June, September to November',
  },
  'los angeles': {
    iata_code: 'LAX',
    country: 'United States',
    timezone: 'America/Los_Angeles',
    currency: 'USD',
    best_time_to_visit: 'March to May, September to November',
  },
  'san francisco': {
    iata_code: 'SFO',
    country: 'United States',
    timezone: 'America/Los_Angeles',
    currency: 'USD',
    best_time_to_visit: 'September to November',
  },
  chicago: {
    iata_code: 'ORD',
    country: 'United States',
    timezone: 'America/Chicago',
    currency: 'USD',
    best_time_to_visit: 'April to June, September to October',
  },
  miami: {
    iata_code: 'MIA',
    country: 'United States',
    timezone: 'America/New_York',
    currency: 'USD',
    best_time_to_visit: 'December to May',
  },
  barcelona: {
    iata_code: 'BCN',
    country: 'Spain',
    timezone: 'Europe/Madrid',
    currency: 'EUR',
    best_time_to_visit: 'May to June, September to October',
  },
  paris: {
    iata_code: 'CDG',
    country: 'France',
    timezone: 'Europe/Paris',
    currency: 'EUR',
    best_time_to_visit: 'April to June, September to October',
  },
  london: {
    iata_code: 'LHR',
    country: 'United Kingdom',
    timezone: 'Europe/London',
    currency: 'GBP',
    best_time_to_visit: 'June to August',
  },
  rome: {
    iata_code: 'FCO',
    country: 'Italy',
    timezone: 'Europe/Rome',
    currency: 'EUR',
    best_time_to_visit: 'April to June, September to October',
  },
  berlin: {
    iata_code: 'BER',
    country: 'Germany',
    timezone: 'Europe/Berlin',
    currency: 'EUR',
    best_time_to_visit: 'May to September',
  },
  amsterdam: {
    iata_code: 'AMS',
    country: 'Netherlands',
    timezone: 'Europe/Amsterdam',
    currency: 'EUR',
    best_time_to_visit: 'April to May, September to November',
  },
  tokyo: {
    iata_code: 'NRT',
    country: 'Japan',
    timezone: 'Asia/Tokyo',
    currency: 'JPY',
    best_time_to_visit: 'March to May, September to November',
  },
  bangkok: {
    iata_code: 'BKK',
    country: 'Thailand',
    timezone: 'Asia/Bangkok',
    currency: 'THB',
    best_time_to_visit: 'November to February',
  },
  sydney: {
    iata_code: 'SYD',
    country: 'Australia',
    timezone: 'Australia/Sydney',
    currency: 'AUD',
    best_time_to_visit: 'September to November, March to May',
  },
  dubai: {
    iata_code: 'DXB',
    country: 'United Arab Emirates',
    timezone: 'Asia/Dubai',
    currency: 'AED',
    best_time_to_visit: 'November to March',
  },
  singapore: {
    iata_code: 'SIN',
    country: 'Singapore',
    timezone: 'Asia/Singapore',
    currency: 'SGD',
    best_time_to_visit: 'February to April',
  },
  'hong kong': {
    iata_code: 'HKG',
    country: 'China',
    timezone: 'Asia/Hong_Kong',
    currency: 'HKD',
    best_time_to_visit: 'October to December',
  },
  lisbon: {
    iata_code: 'LIS',
    country: 'Portugal',
    timezone: 'Europe/Lisbon',
    currency: 'EUR',
    best_time_to_visit: 'March to May, September to October',
  },
  istanbul: {
    iata_code: 'IST',
    country: 'Turkey',
    timezone: 'Europe/Istanbul',
    currency: 'TRY',
    best_time_to_visit: 'April to May, September to November',
  },
  'mexico city': {
    iata_code: 'MEX',
    country: 'Mexico',
    timezone: 'America/Mexico_City',
    currency: 'MXN',
    best_time_to_visit: 'March to May',
  },
  cancun: {
    iata_code: 'CUN',
    country: 'Mexico',
    timezone: 'America/Cancun',
    currency: 'MXN',
    best_time_to_visit: 'December to April',
  },
  'buenos aires': {
    iata_code: 'EZE',
    country: 'Argentina',
    timezone: 'America/Argentina/Buenos_Aires',
    currency: 'ARS',
    best_time_to_visit: 'October to December',
  },
  seoul: {
    iata_code: 'ICN',
    country: 'South Korea',
    timezone: 'Asia/Seoul',
    currency: 'KRW',
    best_time_to_visit: 'April to June, September to November',
  },
  madrid: {
    iata_code: 'MAD',
    country: 'Spain',
    timezone: 'Europe/Madrid',
    currency: 'EUR',
    best_time_to_visit: 'March to May, September to November',
  },
};

export function getDestinationInfo(input: DestinationInput): DestinationResult {
  const normalized = input.city_name.trim().toLowerCase();
  const city = CITY_DATABASE[normalized];

  if (!city) {
    return {
      city_name: input.city_name.trim(),
      iata_code: null,
      country: null,
      timezone: null,
      currency: null,
      best_time_to_visit: null,
      error: `City "${input.city_name.trim()}" not found in database. Try a major city name or provide the IATA code directly.`,
    };
  }

  return {
    city_name: input.city_name.trim(),
    iata_code: city.iata_code,
    country: city.country,
    timezone: city.timezone,
    currency: city.currency,
    best_time_to_visit: city.best_time_to_visit,
  };
}
