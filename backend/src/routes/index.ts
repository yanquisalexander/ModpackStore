import { AccountsController } from "@/controllers/Accounts.controller";
import { AdminPublishersController } from "@/controllers/AdminPublishers.controller";
import { ExploreModpacksController } from "@/controllers/ExploreModpacks.controller";
import { UserModpacksController } from '@/controllers/UserModpacksController'; // Added
import { checkModpackPermission } from '@/middlewares/checkModpackPermission'; // Added
import Passport from "@/lib/Passport";
import { Router } from "express";
import { ensureAdmin } from "@/middlewares/adminAuth.middleware";


export const router = Router();

const authMiddleware = Passport.middleware;

router.get("/v1/ping", (req, res) => {
    res.send("pong");
})

router.get("/a", authMiddleware, (req, res) => {
    res.json({ message: "Authenticated" });
})

router.get("/v1/auth/discord/callback", AccountsController.callbackDiscord);
router.get("/v1/auth/me", authMiddleware, AccountsController.getCurrentUser);
router.post("/v1/auth/refresh", AccountsController.refreshTokens);

router.get('/v1/explore', ExploreModpacksController.getHomepage)
router.get('/v1/explore/search', ExploreModpacksController.search)
router.get('/v1/explore/modpack/:modpackId', ExploreModpacksController.getModpack)

// Admin routes
const adminRouter = Router();
adminRouter.use(authMiddleware);
adminRouter.use(ensureAdmin); // Apply admin check to all routes in adminRouter

adminRouter.post("/publishers", AdminPublishersController.createPublisher);
adminRouter.put("/publishers/:publisherId", AdminPublishersController.updatePublisher);
adminRouter.get("/publishers", AdminPublishersController.listPublishers);
adminRouter.get("/publishers/:publisherId", AdminPublishersController.getPublisher);
adminRouter.delete("/publishers/:publisherId", AdminPublishersController.deletePublisher);

router.use("/v1/admin", adminRouter);

// New Modpack Management Routes for Authenticated Users
const modpackRouter = Router();
modpackRouter.use(authMiddleware); // Ensure user is authenticated for all these routes

modpackRouter.post(
    '/',
    checkModpackPermission(['canCreateModpacks']),
    UserModpacksController.createModpack
);

modpackRouter.get(
    '/',
    // Permission logic is handled within listUserModpacks to show only accessible modpacks
    UserModpacksController.listUserModpacks
);

// Add to existing modpackRouter:
modpackRouter.post(
    '/:modpackId/versions',
    checkModpackPermission(['canEditModpacks']), // Or a new 'canCreateVersions' permission
    UserModpacksController.createModpackVersion
);

modpackRouter.get(
    '/:modpackId/versions',
    // For listing, basic auth is fine; sensitive data is not in the list.
    // Permission to view the modpack itself would typically be checked before allowing access to this sub-route.
    UserModpacksController.listModpackVersions
);

modpackRouter.patch(
    '/:modpackId',
    checkModpackPermission(['canEditModpacks']),
    UserModpacksController.updateModpack
);

modpackRouter.delete(
    '/:modpackId',
    checkModpackPermission(['canDeleteModpacks']),
    UserModpacksController.deleteModpack
);

router.use('/v1/modpacks', modpackRouter);

// New router for version-specific actions that don't fit under /modpacks/:modpackId
const versionRouter = Router();
versionRouter.use(authMiddleware); // Ensure user is authenticated

versionRouter.patch(
    '/:versionId',
    checkModpackPermission(['canEditModpacks']), // Permission check needs context of the modpack this version belongs to.
                                                 // The middleware will need to fetch version -> modpack -> publisher.
    UserModpacksController.updateModpackVersion
);

versionRouter.post(
    '/:versionId/publish',
    checkModpackPermission(['canPublishVersions']), // Middleware needs context here too.
    UserModpacksController.publishModpackVersion
);

router.use('/v1/versions', versionRouter); // Register the new version router

router.use((req, res) => {
    res.status(404).json({ message: "Not Found" });
});
