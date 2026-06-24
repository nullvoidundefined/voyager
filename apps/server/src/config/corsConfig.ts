/**
 * CORS middleware configuration. Delegates origin decisions to the shared
 * allowedOrigins module so CORS and the CSRF guard enforce one allowlist.
 */
import cors from 'cors';

import { isAllowedOrigin } from 'app/config/allowedOrigins.js';

export const corsConfig = cors({
  credentials: true,
  origin: (origin, callback) => {
    if (!origin || isAllowedOrigin(origin)) {
      callback(null, origin ?? false);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 7200,
});
