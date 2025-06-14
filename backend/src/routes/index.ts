import { AccountsController } from "@/controllers/Accounts.controller";
import { AdminPublishersController } from "@/controllers/AdminPublishers.controller";
import { ExploreModpacksController } from "@/controllers/ExploreModpacks.controller";
import Passport from "@/lib/Passport";
import { Router } from "express";
import { ensureAdmin } from "@/middlewares/adminAuth.middleware";


export const router = Router();

const authMiddleware = Passport.middleware;

router.get("/ping", (req, res) => {
    res.send("pong");
})

router.get("/a", authMiddleware, (req, res) => {
    res.json({ message: "Authenticated" });
})

router.get("/auth/discord/callback", AccountsController.callbackDiscord);
router.get("/auth/me", authMiddleware, AccountsController.getCurrentUser);
router.post("/auth/refresh", AccountsController.refreshTokens);

router.get('/explore', ExploreModpacksController.getHomepage)
router.get('/explore/search', ExploreModpacksController.search)
router.get('/explore/modpack/:modpackId', ExploreModpacksController.getModpack)

// Admin routes
const adminRouter = Router();
adminRouter.use(authMiddleware);
adminRouter.use(ensureAdmin); // Apply admin check to all routes in adminRouter

adminRouter.post("/publishers", AdminPublishersController.createPublisher);
adminRouter.put("/publishers/:publisherId", AdminPublishersController.updatePublisher);
adminRouter.get("/publishers", AdminPublishersController.listPublishers);
adminRouter.get("/publishers/:publisherId", AdminPublishersController.getPublisher);
adminRouter.delete("/publishers/:publisherId", AdminPublishersController.deletePublisher);

router.use("/admin", adminRouter);

router.use((req, res) => {
    res.status(404).json({ message: "Not Found" });
});
