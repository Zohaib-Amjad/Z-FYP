import { Router } from 'express';
import { list, markAllRead, markRead, unreadCount } from '../controllers/notification.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { idParamsSchema } from '../validators/common';
import { notificationsQuerySchema } from '../validators/notification.validators';

const router = Router();

router.use(authenticate);
router.get('/', validate({ query: notificationsQuerySchema }), list);
router.get('/unread-count', validate({}), unreadCount);
router.patch('/read-all', validate({}), markAllRead);
router.patch('/:id/read', validate({ params: idParamsSchema }), markRead);

export default router;
