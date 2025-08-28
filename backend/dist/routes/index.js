"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const hono_1 = require("hono");
const auth_routes_1 = __importDefault(require("./v1/auth.routes")); // Now a Hono app
const admin_routes_1 = __importDefault(require("./v1/admin.routes")); // Now a Hono app
// TODO: MIGRATE_ROUTES - These routes need to be migrated to Hono
const explore_routes_1 = __importDefault(require("./v1/explore.routes"));
const index_route_1 = require("./v1/creators/index.route");
const rootRouter = new hono_1.Hono();
// v1 routes
rootRouter.route('/auth', auth_routes_1.default);
rootRouter.route('/admin', admin_routes_1.default); // Mount Hono adminRoutes
rootRouter.route('/explore', explore_routes_1.default); // Mount Hono exploreRoutes
rootRouter.route('/creators', index_route_1.CreatorsRoute);
// TODO: MIGRATE_ROUTES - These routes need to be migrated and then re-added here
// rootRouter.route('/explore', exploreRoutes);
// rootRouter.route('/modpacks', modpackRoutes);
// rootRouter.route('/modpacks/:modpackId/versions', versionRoutes);
// v1 ping
rootRouter.get('/ping', (c) => {
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
exports.default = rootRouter;
