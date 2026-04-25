import type { OrchestratorCart } from '../cart.js';
import type { Quote } from '@openkarta/spec';
import type { ItemType } from '@openkarta/spec';

export interface ConversationState {
  cart?: OrchestratorCart;
  lastQuote?: Quote;
  lastSearch?: { itemType: ItemType; agentIdsSeen: string[] };
}

export function newState(): ConversationState { return {}; }
