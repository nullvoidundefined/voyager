/**
 * Result shape returned by the Tavily search wrapper, consumed by cold-path
 * inventory discovery.
 */

export interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
}
