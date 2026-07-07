import { Notification } from '../models/notification'
import { broadcastToUser } from './websocket'

export async function createNotification(
  userId: string,
  type: string,
  title: string,
  body: string,
  link?: string,
  metadata?: { rideId?: string; reportId?: string; offerId?: string }
) {
  const notification = new Notification({ userId, type, title, body, link, metadata })
  await notification.save()

  broadcastToUser(userId, {
    type: 'new_notification',
    data: {
      _id: notification._id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      link: notification.link,
      metadata: notification.metadata,
      read: false,
      createdAt: notification.createdAt,
    }
  })

  return notification
}
