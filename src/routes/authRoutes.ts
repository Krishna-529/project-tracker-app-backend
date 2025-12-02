import { Router } from 'express';
import { getGoogleUrl, googleCallback, logout, getMe } from '../controllers/authController';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();

router.get('/google/url', getGoogleUrl);
router.get('/google/callback', googleCallback);
router.post('/logout', logout);
router.get('/me', requireAuth, getMe);

export const authRoutes = router;
