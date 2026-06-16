import { query } from 'app/database/pool/pool.js';
import { ApiError } from 'app/errors/ApiError.js';
import { getAuthUser } from 'app/middleware/requireAuth/getAuthUser.js';
import { getTripWithDetails } from 'app/repositories/trips/trips.js';
import type { Request, Response } from 'express';

export async function getTripCostsHandler(
  req: Request<{ id: string }>,
  res: Response,
) {
  const tripId = req.params.id;
  const { id: userId } = getAuthUser(req);

  const trip = await getTripWithDetails(tripId, userId);
  if (!trip) {
    throw ApiError.forbidden('You do not have permission to view this trip');
  }

  const result = await query<{ total_tokens: string; total_cost: string }>(
    `SELECT
       COALESCE(SUM(atc.input_tokens + atc.output_tokens), 0)::int AS total_tokens,
       COALESCE(SUM(atc.estimated_cost_usd), 0)::numeric(10,6) AS total_cost
     FROM agent_turn_cost atc
     JOIN conversations c ON c.id = atc.conversation_id
     WHERE c.trip_id = $1`,
    [tripId],
  );
  const { total_tokens, total_cost } = result.rows[0]!;
  res.json({
    total_tokens: Number(total_tokens),
    total_cost_usd: Number(total_cost).toFixed(4),
  });
}
