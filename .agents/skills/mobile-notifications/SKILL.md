---
name: mobile-notifications
description: Mobile push notification guide covering FCM (Firebase Cloud Messaging) and APNs (Apple Push Notification service) setup, flutter_firebase_messaging and flutter_local_notifications configuration, device token registration and refresh lifecycle, foreground/background/cold-start handling, notification payload design, deep-link routing from notifications, Android notification channels with importance levels, iOS notification categories, in-app notification banners, permission request UX patterns, server-side notification dispatch with stale token cleanup, and notification testing checklist.
refreshMode: full
lastResearched: 2026-09-28
---

# Mobile Notifications Skill

Standards for implementing reliable, platform-correct push notifications from device setup through server dispatch.

---

## 1. Architecture Overview

```
Server (Node.js)
  └── firebase-admin SDK
        └── FCM (Firebase Cloud Messaging)
              ├── Android devices (FCM)
              └── iOS devices (via APNs bridge in FCM)

Mobile App (Flutter)
  ├── firebase_messaging package — receives FCM messages
  ├── flutter_local_notifications — displays in-app notifications (foreground)
  └── deep_link handler — routes user to correct screen on tap
```

**Three app states — must handle ALL three:**

| State | App Is | Notification Arrives | Behavior |
|---|---|---|---|
| **Foreground** | Open & visible | Message received silently | Show custom in-app banner |
| **Background** | Open but hidden | System shows notification | User taps → app resumes → handle tap |
| **Terminated** | Not running | System shows notification | User taps → app launches → handle tap |

---

## 2. Flutter Setup

### pubspec.yaml
```yaml
dependencies:
  firebase_core: ^2.27.0
  firebase_messaging: ^14.9.0
  flutter_local_notifications: ^16.3.0
```

### AndroidManifest.xml additions
```xml
<!-- android/app/src/main/AndroidManifest.xml -->
<manifest>
  <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
  <uses-permission android:name="android.permission.VIBRATE"/>
  <uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>

  <application>
    <!-- FCM metadata -->
    <meta-data
      android:name="com.google.firebase.messaging.default_notification_channel_id"
      android:value="default"/>

    <!-- Deep link intent filter -->
    <activity android:name=".MainActivity" android:exported="true">
      <intent-filter android:autoVerify="true">
        <action android:name="android.intent.action.VIEW"/>
        <category android:name="android.intent.category.DEFAULT"/>
        <category android:name="android.intent.category.BROWSABLE"/>
        <data android:scheme="https" android:host="yourapp.com"/>
      </intent-filter>
    </activity>
  </application>
</manifest>
```

---

## 3. Notification Service Implementation

```dart
// lib/services/notification_service.dart
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

/// Background handler — MUST be a top-level function (not a class method)
@pragma('vm:entry-point')
Future<void> onBackgroundMessage(RemoteMessage message) async {
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  // Process the message if needed (e.g., update local DB)
  // Do NOT show UI here — system shows the notification automatically
}

class NotificationService {
  static final _fcm = FirebaseMessaging.instance;
  static final _localNotif = FlutterLocalNotificationsPlugin();
  static String? _fcmToken;

  /// Call this in main() after Firebase.initializeApp()
  static Future<void> initialize({
    required Future<void> Function(String token) onTokenRegistered,
    required void Function(String? deepLink) onNotificationTap,
  }) async {
    // 1. Register background handler (must be done before requestPermission)
    FirebaseMessaging.onBackgroundMessage(onBackgroundMessage);

    // 2. Request permission with explanation first (see Permission Flow section)
    final settings = await _fcm.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      provisional: false,   // true = quiet notifications on iOS (no sound)
    );
    if (settings.authorizationStatus == AuthorizationStatus.denied) return;

    // 3. Get token and register with backend
    _fcmToken = await _fcm.getToken();
    if (_fcmToken != null) await onTokenRegistered(_fcmToken!);

    // 4. Refresh token listener
    _fcm.onTokenRefresh.listen((newToken) async {
      _fcmToken = newToken;
      await onTokenRegistered(newToken);
    });

    // 5. iOS foreground presentation options
    await _fcm.setForegroundNotificationPresentationOptions(
      alert: true,
      badge: true,
      sound: true,
    );

    // 6. Set up local notifications plugin (for foreground notifications on Android)
    await _initLocalNotifications(onNotificationTap);

    // 7. TERMINATED STATE: app launched by notification tap
    final initial = await _fcm.getInitialMessage();
    if (initial != null) {
      await Future.delayed(const Duration(milliseconds: 500)); // let app init
      onNotificationTap(initial.data['deep_link'] as String?);
    }

    // 8. BACKGROUND STATE: app resumed by notification tap
    FirebaseMessaging.onMessageOpenedApp.listen((message) {
      onNotificationTap(message.data['deep_link'] as String?);
    });

    // 9. FOREGROUND STATE: show in-app notification
    FirebaseMessaging.onMessage.listen((message) {
      _showForegroundNotification(message);
    });
  }

  static Future<void> _initLocalNotifications(
    void Function(String? deepLink) onTap,
  ) async {
    const initSettings = InitializationSettings(
      android: AndroidInitializationSettings('@drawable/ic_notification'),
      iOS: DarwinInitializationSettings(
        requestAlertPermission: false, // already requested above
        requestBadgePermission: false,
        requestSoundPermission: false,
      ),
    );
    await _localNotif.initialize(
      initSettings,
      onDidReceiveNotificationResponse: (details) {
        onTap(details.payload); // payload = deep_link value
      },
    );
    // Create Android channels (see Section 5)
    await _createAndroidChannels();
  }

  static Future<void> _showForegroundNotification(RemoteMessage message) async {
    final notification = message.notification;
    if (notification == null) return;

    await _localNotif.show(
      notification.hashCode,
      notification.title,
      notification.body,
      NotificationDetails(
        android: AndroidNotificationDetails(
          _getChannelId(message.data['type'] as String?),
          _getChannelName(message.data['type'] as String?),
          importance: Importance.high,
          priority: Priority.high,
          icon: '@drawable/ic_notification',
        ),
        iOS: const DarwinNotificationDetails(
          presentAlert: true,
          presentBadge: true,
          presentSound: true,
        ),
      ),
      payload: message.data['deep_link'] as String?,
    );
  }

  static Future<void> _createAndroidChannels() async {
    final channels = <AndroidNotificationChannel>[
      const AndroidNotificationChannel(
        'orders', 'Order Updates',
        description: 'Notifications about your orders',
        importance: Importance.high,
        enableVibration: true,
      ),
      const AndroidNotificationChannel(
        'messages', 'Messages',
        description: 'New messages from other users',
        importance: Importance.high,
        enableVibration: true,
      ),
      const AndroidNotificationChannel(
        'alerts', 'Alerts',
        description: 'Important system alerts',
        importance: Importance.high,
      ),
      const AndroidNotificationChannel(
        'promotions', 'Promotions',
        description: 'Deals and offers',
        importance: Importance.defaultImportance,
        enableVibration: false,
      ),
    ];

    final plugin = _localNotif.resolvePlatformSpecificImplementation<
      AndroidFlutterLocalNotificationsPlugin>();
    for (final channel in channels) {
      await plugin?.createNotificationChannel(channel);
    }
  }

  static String _getChannelId(String? type) {
    return switch (type) {
      'order_update' => 'orders',
      'message' => 'messages',
      'alert' => 'alerts',
      'promo' => 'promotions',
      _ => 'default',
    };
  }

  static String _getChannelName(String? type) {
    return switch (type) {
      'order_update' => 'Order Updates',
      'message' => 'Messages',
      'alert' => 'Alerts',
      'promo' => 'Promotions',
      _ => 'Default',
    };
  }
}
```

---

## 4. Permission Request UX

**Rule: Always explain WHY before showing the OS permission dialog.**

```dart
// Show this screen BEFORE calling requestPermission()
class NotificationPermissionScreen extends StatelessWidget {
  final VoidCallback onAccept;
  final VoidCallback onSkip;

  const NotificationPermissionScreen({
    required this.onAccept,
    required this.onSkip,
    super.key,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.notifications_outlined, size: 80, color: Colors.indigo),
              const SizedBox(height: 24),
              Text(
                'Stay in the loop',
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                'Get notified about order updates, messages, and important alerts. '
                'We only send what matters.',
                style: Theme.of(context).textTheme.bodyLarge,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 40),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: onAccept,
                  child: const Text('Enable notifications'),
                ),
              ),
              const SizedBox(height: 12),
              TextButton(
                onPressed: onSkip,
                child: const Text('Not now'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
```

---

## 5. Notification Payload Design

**Standard payload structure — agree this with backend before implementing:**

```json
{
  "notification": {
    "title": "Your order shipped!",
    "body": "Order #1234 is on its way"
  },
  "data": {
    "type": "order_update",
    "deep_link": "/orders/1234",
    "order_id": "1234",
    "version": "1"
  },
  "android": {
    "notification": {
      "channel_id": "orders",
      "icon": "ic_notification",
      "color": "#4F46E5"
    }
  },
  "apns": {
    "payload": {
      "aps": {
        "sound": "default",
        "badge": 1
      }
    }
  }
}
```

**Notification type → deep link → channel mapping:**

| Type | Deep Link | Android Channel | iOS Category |
|---|---|---|---|
| `order_update` | `/orders/:id` | `orders` (high) | `ORDER_UPDATE` |
| `message` | `/messages/:threadId` | `messages` (high) | `MESSAGE` |
| `alert` | `/notifications` | `alerts` (high) | `ALERT` |
| `promo` | `/explore` | `promotions` (default) | `PROMO` |
| `reminder` | `/tasks/:id` | `reminders` (default) | `REMINDER` |

---

## 6. Server-Side Dispatch (Node.js)

```typescript
// backend/src/services/notification.service.ts
import admin from 'firebase-admin';

// Initialize once at app startup
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
});

export interface NotificationPayload {
  title: string;
  body: string;
  type: 'order_update' | 'message' | 'alert' | 'promo' | 'reminder';
  deepLink?: string;
  data?: Record<string, string>;  // all values must be strings
}

export class NotificationService {
  /** Register or refresh a device token for a user */
  async registerToken(userId: string, token: string, platform: 'ios' | 'android'): Promise<void> {
    await db.deviceTokens.upsert({
      where: { userId_token: { userId, token } },
      create: { userId, token, platform, active: true },
      update: { updatedAt: new Date(), active: true },
    });
  }

  /** Send to a specific user — fan out to all their devices */
  async sendToUser(userId: string, payload: NotificationPayload): Promise<void> {
    const tokens = await db.deviceTokens.findMany({
      where: { userId, active: true },
      select: { token: true },
    });
    if (tokens.length === 0) return;

    const message: admin.messaging.MulticastMessage = {
      notification: { title: payload.title, body: payload.body },
      data: {
        type: payload.type,
        deep_link: payload.deepLink ?? '',
        ...payload.data,
      },
      tokens: tokens.map(t => t.token),
      android: {
        notification: {
          channelId: this.getChannelId(payload.type),
          icon: 'ic_notification',
          color: '#4F46E5',
          clickAction: 'FLUTTER_NOTIFICATION_CLICK',
        },
      },
      apns: {
        payload: { aps: { sound: 'default', badge: 1 } },
      },
    };

    const response = await admin.messaging().sendEachForMulticast(message);

    // Clean up stale tokens (invalid registration = token expired/uninstalled)
    const staleTokens = response.responses
      .map((r, i) => r.error?.code === 'messaging/registration-token-not-registered'
        ? tokens[i].token : null)
      .filter((t): t is string => t !== null);

    if (staleTokens.length > 0) {
      await db.deviceTokens.updateMany({
        where: { token: { in: staleTokens } },
        data: { active: false },
      });
    }
  }

  /** Send to a topic (e.g., 'all-users', 'premium-users') */
  async sendToTopic(topic: string, payload: NotificationPayload): Promise<void> {
    await admin.messaging().send({
      topic,
      notification: { title: payload.title, body: payload.body },
      data: { type: payload.type, deep_link: payload.deepLink ?? '' },
    });
  }

  private getChannelId(type: NotificationPayload['type']): string {
    const map: Record<string, string> = {
      order_update: 'orders',
      message: 'messages',
      alert: 'alerts',
      promo: 'promotions',
      reminder: 'reminders',
    };
    return map[type] ?? 'default';
  }
}
```

---

## 7. Deep Link Routing

```dart
// lib/router/app_router.dart — deep link handler
void handleDeepLink(String? deepLink) {
  if (deepLink == null || deepLink.isEmpty) return;

  // Parse path and navigate
  final uri = Uri.tryParse(deepLink);
  if (uri == null) return;

  // Use GoRouter to navigate
  final context = navigatorKey.currentContext;
  if (context == null) return;
  GoRouter.of(context).go(uri.path, extra: uri.queryParameters);
}

// Deep link patterns
// /orders/123          → OrderDetailScreen(orderId: '123')
// /messages/456        → MessageThreadScreen(threadId: '456')
// /notifications       → NotificationsScreen()
// /tasks/789           → TaskDetailScreen(taskId: '789')
```

---

## 8. Notification Quality Checklist

- [ ] All 3 app states handled: foreground, background, terminated
- [ ] Permission requested with explanation screen (not raw OS dialog)
- [ ] Android notification channels created for each notification type
- [ ] iOS presentation options set for foreground notifications
- [ ] Device token registration sent to backend after each login
- [ ] Token refresh listener registered (tokens can change)
- [ ] Stale token cleanup implemented (inactive = false, not hard delete)
- [ ] In-app notification banner shows for foreground messages
- [ ] Deep links tested for all notification types
- [ ] Backend sends `type` and `deep_link` in `data` payload (not `notification`)
- [ ] Notification icon is a white/transparent PNG (Android requirement)
- [ ] APNs certificate or key configured in Firebase console
- [ ] Cold-start delay handled before routing to deep link screen

---

## 9. Common Mistakes

| Mistake | Correct Approach |
|---|---|
| Using `notification` payload for deep links | Always use `data` payload for app-defined fields |
| Not handling cold-start delay | Add 500ms delay before navigating on initial message |
| Hardcoding FCM server key in client code | Server key is BACKEND only — never in the app |
| Not cleaning up stale tokens | Mark as inactive after `registration-token-not-registered` error |
| Showing OS permission dialog immediately on install | Show explanation screen first, then request permission |
| One Android channel for all notifications | One channel per notification category (correct importance per type) |
| Background handler is a class method | Must be a top-level function annotated `@pragma('vm:entry-point')` |
