/**
 * Resolves a free-text city or country name to a static destination image URL.
 * Exists so LLM-suggested place names (not just curated destinations) still get
 * a representative hero image, with curated slugs winning over the extended list.
 */
import { DESTINATIONS } from '../data/destinations';

// Build the base lookup from curated destinations. Curated slugs take
// precedence over the extended list, so renaming a slug in destinations.ts
// automatically propagates here without a manual sync.
const curatedSlugs: Record<string, string> = Object.fromEntries(
  DESTINATIONS.map((d) => [d.name.toLowerCase(), d.slug]),
);

// Extended lookup for LLM-suggested cities not in the curated list.
// Cities present in DESTINATIONS are intentionally omitted here to avoid
// maintaining two sources of truth for the same slug.
const EXTENDED_CITY_SLUGS: Record<string, string> = {
  'new york': 'new-york',
  'los angeles': 'los-angeles',
  chicago: 'chicago',
  houston: 'houston',
  phoenix: 'phoenix',
  philadelphia: 'philadelphia',
  'san antonio': 'san-antonio',
  'san diego': 'san-diego',
  dallas: 'dallas',
  'san jose': 'san-jose',
  austin: 'austin',
  'san francisco': 'san-francisco',
  seattle: 'seattle',
  denver: 'denver',
  nashville: 'nashville',
  'las vegas': 'las-vegas',
  miami: 'miami',
  atlanta: 'atlanta',
  boston: 'boston',
  washington: 'washington-dc',
  'washington dc': 'washington-dc',
  'washington, d.c.': 'washington-dc',
  'new orleans': 'new-orleans',
  portland: 'portland',
  minneapolis: 'minneapolis',
  sacramento: 'sacramento',
  tampa: 'tampa',
  orlando: 'orlando',
  baltimore: 'baltimore',
  honolulu: 'honolulu',
  'salt lake city': 'salt-lake-city',
  raleigh: 'raleigh',
  memphis: 'memphis',
  pittsburgh: 'pittsburgh',
  'st. louis': 'st-louis',
  cincinnati: 'cincinnati',
  'kansas city': 'kansas-city',
  columbus: 'columbus',
  indianapolis: 'indianapolis',
  charlotte: 'charlotte',
  louisville: 'louisville',
  milwaukee: 'milwaukee',
  detroit: 'detroit',
  savannah: 'savannah',
  charleston: 'charleston',
  asheville: 'asheville',
  'santa fe': 'santa-fe',
  'key west': 'key-west',
  sedona: 'sedona',
  napa: 'napa',
  'jackson hole': 'jackson-hole',
  aspen: 'aspen',
  anchorage: 'anchorage',
  albuquerque: 'albuquerque',
  tucson: 'tucson',
  'oklahoma city': 'oklahoma-city',
  'el paso': 'el-paso',
  jacksonville: 'jacksonville',
  'fort worth': 'fort-worth',
  boise: 'boise',
  richmond: 'richmond',
  toronto: 'toronto',
  vancouver: 'vancouver',
  montreal: 'montreal',
  'quebec city': 'quebec-city',
  calgary: 'calgary',
  warsaw: 'warsaw',
  stockholm: 'stockholm',
  oslo: 'oslo',
  copenhagen: 'copenhagen',
  helsinki: 'helsinki',
  reykjavik: 'reykjavik',
  dublin: 'dublin',
  zurich: 'zurich',
  'tel aviv': 'tel-aviv',
  amman: 'amman',
  beirut: 'beirut',
  jakarta: 'jakarta',
  manila: 'manila',
  dhaka: 'dhaka',
  karachi: 'karachi',
  islamabad: 'islamabad',
  tehran: 'tehran',
  ulaanbaatar: 'ulaanbaatar',
  'phnom penh': 'phnom-penh',
  yangon: 'yangon',
  havana: 'havana',
  cartagena: 'cartagena',
  cusco: 'cusco',
  quito: 'quito',
  montevideo: 'montevideo',
  'panama city': 'panama-city',
  nairobi: 'nairobi',
  casablanca: 'casablanca',
  johannesburg: 'johannesburg',
  'addis ababa': 'addis-ababa',
  lagos: 'lagos',
  accra: 'accra',
  'dar es salaam': 'dar-es-salaam',
  tunis: 'tunis',
  brisbane: 'brisbane',
  perth: 'perth',
  wellington: 'wellington',
  maldives: 'maldives',
  'bora bora': 'bora-bora',
};

// Curated destinations win over the extended list.
const CITY_SLUGS: Record<string, string> = {
  ...EXTENDED_CITY_SLUGS,
  ...curatedSlugs,
};

// Country -> first-listed city slug, so a country-level destination
// ("Portugal") still resolves to a representative image ("lisbon.jpg").
// First-occurrence wins, so curation order in DESTINATIONS controls
// which city represents a multi-city country (Italy -> Rome, not Naples).
const COUNTRY_SLUGS: Record<string, string> = DESTINATIONS.reduce(
  (acc, d) => {
    const key = d.country.toLowerCase();
    if (!(key in acc)) acc[key] = d.slug;
    return acc;
  },
  {} as Record<string, string>,
);

export function getDestinationImage(cityName: string): { url: string | null } {
  const key = cityName.toLowerCase().trim();
  const slug = CITY_SLUGS[key] ?? COUNTRY_SLUGS[key] ?? null;
  return { url: slug ? `/images/destinations/${slug}.jpg` : null };
}

export const HERO_IMAGES = [
  { city: 'Santorini', url: '/images/destinations/santorini.jpg' },
  { city: 'Tokyo', url: '/images/destinations/tokyo.jpg' },
  { city: 'Paris', url: '/images/destinations/paris.jpg' },
  { city: 'Bali', url: '/images/destinations/bali.jpg' },
  { city: 'New York', url: '/images/destinations/new-york.jpg' },
];
