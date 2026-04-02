import { photoProxyHandler } from 'app/handlers/places/photoProxy.handler.js';
import express from 'express';

const placesRouter = express.Router();

placesRouter.get('/photo', photoProxyHandler);

export { placesRouter };
