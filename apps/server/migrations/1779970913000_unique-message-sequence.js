export const up = (pgm) => {
  // Make per-conversation message ordering a database invariant rather than
  // relying solely on the application conversation lock. insertMessage computes
  // sequence via MAX+1 under that lock; this constraint guarantees two rows can
  // never share a sequence even if a future caller writes outside the lock.
  pgm.addConstraint('messages', 'messages_conversation_sequence_unique', {
    unique: ['conversation_id', 'sequence'],
  });
};

export const down = (pgm) => {
  pgm.dropConstraint('messages', 'messages_conversation_sequence_unique');
};
