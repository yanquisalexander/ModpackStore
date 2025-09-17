import { Hono, Context } from 'hono';
import authRoutes from './v1/auth.routes'; // Now a Hono app
import adminRoutes from './v1/admin.routes'; // Now a Hono app
// TODO: MIGRATE_ROUTES - These routes need to be migrated to Hono
import exploreRoutes from './v1/explore.routes';
import categoriesRoutes from './v1/categories.routes';
import { CreatorsRoute } from "./v1/creators/index.route";
import websocketRoutes from './v1/websocket.routes';
import ticketRoutes from './v1/tickets.routes';

const rootRouter = new Hono();

// v1 routes
rootRouter.route('/auth', authRoutes);
rootRouter.route('/admin', adminRoutes); // Mount Hono adminRoutes
rootRouter.route('/explore', exploreRoutes); // Mount Hono exploreRoutes
rootRouter.route('/categories', categoriesRoutes);
rootRouter.route('/creators', CreatorsRoute);
rootRouter.route('/websocket', websocketRoutes);
rootRouter.route('/tickets', ticketRoutes);

// TODO: MIGRATE_ROUTES - These routes need to be migrated and then re-added here
// rootRouter.route('/explore', exploreRoutes);
// rootRouter.route('/modpacks', modpackRoutes);
// rootRouter.route('/modpacks/:modpackId/versions', versionRoutes);


// v1 ping
rootRouter.get('/ping', (c: Context) => {
  return c.json({
    message: 'pong',
    timestamp: new Date().toISOString(),
  }, 200);
});

// 404 Handler for all other routes on this router
// Note: In Hono, a global `app.notFound` in index.ts is often preferred for overall 404s.
// This will catch routes not matched within this `rootRouter` specifically.
// If this router is mounted under /v1, this will handle /v1/* not found.

// It's also possible to use app.all for a catch-all, but notFound is more specific.
// rootRouter.all('*', (c: Context) => {
//   throw new APIError(404, 'Route not found');
// });

export default rootRouter;
