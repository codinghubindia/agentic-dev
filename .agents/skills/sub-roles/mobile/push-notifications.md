# Mobile Sub-Role: Push Notifications Infrastructure

Consolidated from `push-notification-worker`.

## Responsibilities & Standards
- Implement push notification handling across FCM (Android) and APNs (iOS).

## Push Notifications Checklist
- [ ] Permission Flow: Polite, in-context permission prompt explaining value before triggering system OS permission modal.
- [ ] Lifecycle Handlers: Foreground (banner/snack), background (notification tray), and cold-start launch handlers implemented.
- [ ] Deep-Link Routing: Tapping a notification parses payload (`route`, `entityId`) and navigates directly to target screen.
- [ ] Token Registration: Device tokens synchronized to backend with platform tags; stale/unregistered tokens purged on error.
- [ ] Android Channels: Setup notification channels with user-controllable importance levels (high/default/low).
