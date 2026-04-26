import type { OrchestratorCart } from '../cart.js';
import type { ItemType, Quote } from '@openkarta/spec';

export interface ConversationState {
  cart?: OrchestratorCart;
  lastQuote?: Quote;
  lastSearch?: { itemType: ItemType; agentIdsSeen: string[] };
}

export function newState(): ConversationState { return {}; }
