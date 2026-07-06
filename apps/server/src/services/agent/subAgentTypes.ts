/**
 * Sub-agent vocabulary: the three core conversation-flow agents plus one
 * sub-agent per segment kind (the SegmentKind values themselves).
 */
import type { SegmentKind } from '@repo/types';

export type SubAgentType =
  | 'conversation'
  | 'detail'
  | 'discover'
  | 'plan'
  | SegmentKind;
