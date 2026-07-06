/**
 * Sub-agent vocabulary: the three core conversation-flow agents plus one
 * sub-agent per segment kind (the SegmentKind values themselves).
 */
import type { SegmentKind } from '@repo/types';

export type SubAgentType = 'detail' | 'plan' | 'conversation' | SegmentKind;

export type CoreSubAgentType = 'detail' | 'plan' | 'conversation';
