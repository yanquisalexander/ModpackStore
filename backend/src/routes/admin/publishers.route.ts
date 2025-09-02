import { Hono } from 'hono';
import { AdminPublishersController } from '../../controllers/AdminPublishers.controller';

const adminPublishersRouter = new Hono();

// CRUD routes for publishers
adminPublishersRouter.post('/', AdminPublishersController.createPublisher);
adminPublishersRouter.get('/', AdminPublishersController.listPublishers);
adminPublishersRouter.get('/:publisherId', AdminPublishersController.getPublisher);
adminPublishersRouter.put('/:publisherId', AdminPublishersController.updatePublisher);
adminPublishersRouter.delete('/:publisherId', AdminPublishersController.deletePublisher);

// Member management routes
adminPublishersRouter.post('/:publisherId/members', AdminPublishersController.addMember);
adminPublishersRouter.delete('/:publisherId/members/:userId', AdminPublishersController.removeMember);
adminPublishersRouter.get('/:publisherId/members', AdminPublishersController.getMembers);

// Modpack management routes  
adminPublishersRouter.get('/:publisherId/modpacks', AdminPublishersController.getModpacks);

export default adminPublishersRouter;