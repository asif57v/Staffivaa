import { getMessaging, getApps } from '../config/firebase.js';

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
