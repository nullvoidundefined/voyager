/**
 * Segment capability descriptor: the per-kind data that used to be threaded
 * through SEARCH_TOOLS / SELECTION_KEYS / SELECT_TOOLS / SUB_AGENT_TOOLS and
 * buildDefaultPlanCard. Adding a travel mode registers one of these instead of
 * editing six files.
 */
import type {
  Offer,
  OfferKind,
  SegmentKind,
  TripPlanCategoryId,
} from '@repo/types';

export interface SegmentCapability {
  kind: SegmentKind;
  label: string;
  searchTool: string;
  selectTool: string;
  /** Trip-context selection collection name (legacy plural). */
  selectionKey: string;
  tileKind: OfferKind;
  /** Key of the offers array in the search tool's result payload
   *  ('flights' | 'hotels' | 'rentals' | 'experiences' | ...). */
  resultListKey: string;
  /** Maps one raw search-result item to the generic Offer shape. */
  toOffer: (item: unknown) => Offer;
  /** Plan-card category id; legacy plural ids for the original four kinds. */
  planCategoryId: TripPlanCategoryId;
  /** Tools available to this segment's sub-agent turn (legacy lists verbatim). */
  subAgentTools: string[];
  /** Tools that must be present for the turn to proceed. */
  requiredTools: string[];
  /** Segment kinds that must be resolved before this one is worked (routing). */
  requires?: SegmentKind[];
  /** Presentation-order gate when it differs from the routing gate: the legacy
   *  prompt gates experiences on hotel while routing gates on flight. Prompt
   *  generation uses presentationRequires ?? requires. */
  presentationRequires?: SegmentKind[];
  /** Derives the knowledge-base lookup keys (normalized region and optional
   *  route) from the search tool's validated params. */
  buildSearchKeys: (params: Record<string, unknown>) => SegmentSearchKeys;
  /** Opt-in cold-path web discovery for modes without a structured API; the
   *  query builder turns the validated search params into a search string. */
  webDiscovery?: {
    buildQuery: (input: WebDiscoveryQueryInput) => string;
  };
}

export interface SegmentSearchKeys {
  region: string;
  routeKey?: string;
}

export interface WebDiscoveryQueryInput {
  kind: SegmentKind;
  region: string;
  routeKey?: string;
  params: Record<string, unknown>;
}
