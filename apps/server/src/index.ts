/**
 * Process entry point. Loads environment variables before any app module, then
 * dynamically imports and starts the server so dotenv runs first.
 */
import 'dotenv/config';

const { startServer } = await import('app/app.js');
startServer();
