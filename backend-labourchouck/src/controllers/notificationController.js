import { getMessaging, getApps } from '../config/firebase.js';
import { Notification } from '../models/Notification.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess, sendError, HTTP_STATUS } from '../utils/apiResponse.js';

export const sendTestNotification = async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, message: 'FCM token is required' });
    }

    if (getApps().length === 0) {
      return res.status(500).json({ success: false, message: 'Firebase Admin SDK is not initialized' });
    }

    const payload = {
      token: token,
      notification: {
        title: 'Staffivaa Test Notification',
        body: 'If you are seeing this, your push notifications are working perfectly!'
      },
      data: {
        testId: '12345',
        click_action: 'FLUTTER_NOTIFICATION_CLICK'
      }
    };

    const response = await getMessaging().send(payload);
    
    res.status(200).json({
      success: true,
      message: 'Test notification sent successfully',
      messageId: response
    });
  } catch (err) {
    console.error('Error sending test notification:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to send notification',
      error: err.message
    });
  }
};

export const getNotifications = asyncHandler(async (req, res) => {
  const query = { $or: [{ userId: req.user._id }] };
  
  if (req.user.role === 'admin') {
    query.$or.push({ userId: { $exists: false } }, { userId: null });
  }

  const notifications = await Notification.find(query)
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  const unreadCount = await Notification.countDocuments({ ...query, isRead: false });

  return sendSuccess(res, {
    data: {
      notifications,
      unreadCount
    }
  });
});

export const markRead = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const notification = await Notification.findById(id);
  if (!notification) {
    return sendError(res, { message: 'Notification not found', statusCode: HTTP_STATUS.NOT_FOUND });
  }

  notification.isRead = true;
  await notification.save();

  return sendSuccess(res, {
    data: { notification }
  });
});

export const markAllRead = asyncHandler(async (req, res) => {
  const query = { userId: req.user._id };
  
  const updateQuery = { userId: req.user._id };
  if (req.user.role === 'admin') {
    updateQuery.$or = [{ userId: req.user._id }, { userId: null }, { userId: { $exists: false } }];
  }

  await Notification.updateMany({ ...updateQuery, isRead: false }, { $set: { isRead: true } });

  return sendSuccess(res, {
    message: 'All notifications marked as read'
  });
});

export const deleteNotification = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const notification = await Notification.findById(id);
  if (!notification) {
    return sendError(res, { message: 'Notification not found', statusCode: HTTP_STATUS.NOT_FOUND });
  }

  await notification.deleteOne();

  return sendSuccess(res, {
    message: 'Notification deleted'
  });
});
