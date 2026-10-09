/**
 * HTML5 Web Notification API Helper
 * Manages browser push notification permissions and delivery.
 */

export function isBrowserNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getBrowserNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isBrowserNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

export async function requestBrowserNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isBrowserNotificationSupported()) return 'unsupported';
  try {
    const result = await Notification.requestPermission();
    return result;
  } catch (err) {
    console.warn('Failed to request notification permission:', err);
    return Notification.permission;
  }
}

export function sendBrowserNotification(
  title: string,
  options?: {
    body?: string;
    tag?: string;
    icon?: string;
    onClick?: () => void;
  }
): boolean {
  if (!isBrowserNotificationSupported()) return false;
  if (Notification.permission !== 'granted') return false;

  try {
    const notification = new Notification(title, {
      body: options?.body || '',
      tag: options?.tag,
      icon: options?.icon || '/icon-192.png',
      badge: '/icon-192.png',
    });

    notification.onclick = () => {
      try {
        window.focus();
        if (options?.onClick) {
          options.onClick();
        }
      } catch (e) {
        console.warn('Notification click focus error', e);
      }
      notification.close();
    };

    return true;
  } catch (err) {
    console.warn('Browser notification send error:', err);
    return false;
  }
}
