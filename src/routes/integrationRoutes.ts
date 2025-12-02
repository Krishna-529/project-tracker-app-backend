import { Router } from 'express';
import { sendToDailyQuest } from '../controllers/integrationController';
import { requireAuth } from '../middleware/requireAuth';

export const integrationRoutes = Router();

integrationRoutes.use(requireAuth);

integrationRoutes.post('/daily-quest/:nodeId', sendToDailyQuest);
