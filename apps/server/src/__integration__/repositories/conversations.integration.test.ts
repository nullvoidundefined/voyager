import { describe, expect, it } from 'vitest';

import { pool } from 'app/database/pool/pool.js';
import { DEFAULT_COMPLETION_TRACKER } from 'app/prompts/bookingSteps/bookingSteps.js';
import {
  getMessagesByConversation,
  getOrCreateConversation,
  insertMessage,
  updateBookingState,
} from 'app/repositories/conversations.js';

import { seedConversation, seedTrip, seedUser } from '../helpers/seed.js';

describe('conversations repository integration', () => {
  describe('getOrCreateConversation', () => {
    it('creates a conversation when none exists for the trip', async () => {
      const user = await seedUser();
      const trip = await seedTrip(user.id);

      const conversation = await getOrCreateConversation(trip.id);

      expect(conversation.id).toBeDefined();
      expect(conversation.trip_id).toBe(trip.id);

      const dbResult = await pool.query(
        'SELECT * FROM conversations WHERE id = $1',
        [conversation.id],
      );
      expect(dbResult.rows).toHaveLength(1);
    });

    it('returns the existing conversation on second call (idempotent)', async () => {
      const user = await seedUser();
      const trip = await seedTrip(user.id);

      const first = await getOrCreateConversation(trip.id);
      const second = await getOrCreateConversation(trip.id);

      expect(second.id).toBe(first.id);

      const dbResult = await pool.query(
        'SELECT * FROM conversations WHERE trip_id = $1',
        [trip.id],
      );
      expect(dbResult.rows).toHaveLength(1);
    });
  });

  describe('insertMessage', () => {
    it('inserts a message and assigns an incrementing sequence', async () => {
      const user = await seedUser();
      const trip = await seedTrip(user.id);
      const conversation = await seedConversation(trip.id);

      const msg = await insertMessage({
        conversation_id: conversation.id,
        role: 'user',
        content: 'Hello, plan my trip',
        nodes: [],
      });

      expect(msg.id).toBeDefined();
      expect(msg.conversation_id).toBe(conversation.id);
      expect(msg.role).toBe('user');
      expect(msg.content).toBe('Hello, plan my trip');
      expect(msg.sequence).toBe(1);
    });

    it('increments sequence for each additional message', async () => {
      const user = await seedUser();
      const trip = await seedTrip(user.id);
      const conversation = await seedConversation(trip.id);

      const msg1 = await insertMessage({
        conversation_id: conversation.id,
        role: 'user',
        content: 'First message',
        nodes: [],
      });
      const msg2 = await insertMessage({
        conversation_id: conversation.id,
        role: 'assistant',
        content: 'Second message',
        nodes: [],
      });

      expect(msg1.sequence).toBe(1);
      expect(msg2.sequence).toBe(2);
    });
  });

  describe('getMessagesByConversation', () => {
    it('returns messages ordered by created_at ascending', async () => {
      const user = await seedUser();
      const trip = await seedTrip(user.id);
      const conversation = await seedConversation(trip.id);

      await insertMessage({
        conversation_id: conversation.id,
        role: 'user',
        content: 'First',
        nodes: [],
      });
      await insertMessage({
        conversation_id: conversation.id,
        role: 'assistant',
        content: 'Second',
        nodes: [],
      });

      const messages = await getMessagesByConversation(conversation.id);

      expect(messages).toHaveLength(2);
      expect(messages[0]!.content).toBe('First');
      expect(messages[1]!.content).toBe('Second');
    });

    it('returns empty array for a conversation with no messages', async () => {
      const user = await seedUser();
      const trip = await seedTrip(user.id);
      const conversation = await seedConversation(trip.id);

      const messages = await getMessagesByConversation(conversation.id);
      expect(messages).toHaveLength(0);
    });
  });

  describe('updateBookingState', () => {
    it('persists the new booking state to the DB', async () => {
      const user = await seedUser();
      const trip = await seedTrip(user.id);
      const conversation = await seedConversation(trip.id);

      const newState: typeof DEFAULT_COMPLETION_TRACKER = {
        ...DEFAULT_COMPLETION_TRACKER,
        flights: 'selected',
      };

      await updateBookingState(conversation.id, newState);

      const dbResult = await pool.query(
        'SELECT booking_state FROM conversations WHERE id = $1',
        [conversation.id],
      );
      expect(dbResult.rows[0].booking_state.flights).toBe('selected');
    });
  });
});
