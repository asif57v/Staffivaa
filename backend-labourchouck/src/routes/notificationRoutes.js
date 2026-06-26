import { Router } from 'express';
import { sendTestNotification } from '../controllers/notificationController.js';

const router = Router();

router.post('/test', sendTestNotification);

export default router;
