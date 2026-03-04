/**
 * lib/capacitor/pushNotifications.ts
 *
 * Wrapper around @capacitor/push-notifications for Android.
 *
 * Responsibilities:
 *   - Request push permission on Android 13+
 *   - Register with FCM and return the device token
 *   - Listen for notification taps and invoke a navigation callback
 *
 * This module is the only place that imports @capacitor/push-notifications.
 * It is called from App.tsx on startup — never from feature code.
 *
 * iOS support is intentionally stubbed (Capacitor config is identical,
 * but APNs key provisioning and app capability are out of scope for V1).
 *
 * On web (desktop dev), all calls are no-ops.
 */

import { Capacitor } from '@capacitor/core';
import {
  PushNotifications,
  type ActionPerformed,
  type Token,
} from '@capacitor/push-notifications';

export type NotificationData = {
  type: 'expense' | 'group_member';
  expenseId?: string;
  groupId?: string;
  friendId?: string;
};

export type NotificationTapHandler = (data: NotificationData) => void;

/**
 * Requests push permission, registers the device with FCM, and sets up
 * the notification-tap listener.
 *
 * @param onToken   - called once with the FCM registration token
 * @param onTap     - called whenever the user taps a notification
 * @returns cleanup function (call on unmount / sign-out)
 */
export async function initPushNotifications(
  onToken: (token: string) => void,
  onTap: NotificationTapHandler,
): Promise<() => void> {
  if (!Capacitor.isNativePlatform()) {
    return () => {};
  }

  // Request permission (required on Android 13+ / API level 33)
  const { receive } = await PushNotifications.requestPermissions();
  if (receive !== 'granted') {
    console.info('Push notification permission denied');
    return () => {};
  }

  // Kick off FCM registration; token arrives via the 'registration' event
  await PushNotifications.register();

  const registrationListener = await PushNotifications.addListener(
    'registration',
    (token: Token) => {
      onToken(token.value);
    },
  );

  const errorListener = await PushNotifications.addListener(
    'registrationError',
    (err) => {
      console.error('Push registration failed', err);
    },
  );

  // Notification received while app is in the foreground — no default UI,
  // so we do nothing here (background notifications are handled by the OS).
  const foregroundListener = await PushNotifications.addListener(
    'pushNotificationReceived',
    () => {
      // Intentionally empty: foreground notifications are silent in V1.
      // A future iteration could show an in-app banner here.
    },
  );

  // User tapped a notification (foreground or background)
  const tapListener = await PushNotifications.addListener(
    'pushNotificationActionPerformed',
    (action: ActionPerformed) => {
      const raw = action.notification.data as Record<string, string> | undefined;
      if (!raw?.type) return;
      onTap({
        type: raw.type as NotificationData['type'],
        ...(raw.expenseId !== undefined && { expenseId: raw.expenseId }),
        ...(raw.groupId !== undefined && { groupId: raw.groupId }),
        ...(raw.friendId !== undefined && { friendId: raw.friendId }),
      });
    },
  );

  return () => {
    registrationListener.remove();
    errorListener.remove();
    foregroundListener.remove();
    tapListener.remove();
  };
}
