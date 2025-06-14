import { Router } from 'express';
import { APIError } from '../lib/APIError';
import adminRoutes from './v1/admin.routes';
import authRoutes from './v1/auth.routes';
import exploreRoutes from './v1/explore.routes';
import modpackRoutes from './v1/modpacks.routes';
import versionRoutes from './v1/versions.routes';

const router = Router();

// v1 routes
router.use('/v1/auth', authRoutes);
router.use('/v1/admin', adminRoutes);
router.use('/v1/explore', exploreRoutes);
router.use('/v1/modpacks', modpackRoutes);
router.use('/v1/modpacks/:modpackId/versions', versionRoutes); // This is the one I'm working on

// v1 ping
router.get('/v1/ping', (_req, res) => {
  res.status(200).json({
    message: 'pong',
    timestamp: new Date().toISOString(),
  });
});

router.all('*', (_req, _res, next) => {
  next(new APIError(404, 'Route not found'));
});

export default router;
