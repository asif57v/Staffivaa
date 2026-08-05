import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import {
  sendTestNotification,
  createSelfTestNotification,
  getNotifications,
  markRead,
  markAllRead,
  deleteNotification
} from '../controllers/notificationController.js';

const router = Router();

router.post('/test', sendTestNotification);

router.use(protect);
router.post('/send-test', createSelfTestNotification);
router.get('/', getNotifications);
router.patch('/read-all', markAllRead);
router.patch('/:id/read', markRead);
router.delete('/:id', deleteNotification);

export default router;
