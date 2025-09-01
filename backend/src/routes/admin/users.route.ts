import { Hono } from 'hono';
import { AdminUsersController } from '../../controllers/AdminUsers.controller';
import { ensureAdmin } from '../../middlewares/adminAuth.middleware';

const usersRoute = new Hono();

usersRoute.use('*', ensureAdmin);

usersRoute.get('/', AdminUsersController.listUsers);
usersRoute.post('/', AdminUsersController.createUser);
usersRoute.get('/stats', AdminUsersController.getUserStats);
usersRoute.get('/:userId', AdminUsersController.getUser);
usersRoute.patch('/:userId', AdminUsersController.updateUser);
usersRoute.delete('/:userId', AdminUsersController.deleteUser);

export default usersRoute;
