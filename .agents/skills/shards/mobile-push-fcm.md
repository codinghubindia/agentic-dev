# Micro-Skill: Mobile Push Notifications & FCM/APNs

**Scope**: Mobile push notifications, FCM/APNs token lifecycle, and deep-link routing.

## Rules & Checklists
1. **Permission Timing**:
   - Never prompt for notification permissions immediately on cold start.
   - Show an explanatory pre-permission modal in context (e.g. after user places an order or enables alerts).
2. **Token Registration & Refresh**:
   - Register FCM/APNs device token on backend alongside user ID, platform (`ios`/`android`), and app version.
   - Listen to `onTokenRefresh` events and synchronize updated tokens to the backend immediately.
3. **Tri-State Message Handling**:
   - Foreground: Present custom in-app snackbar or banner without interrupting active workflow.
   - Background: Deliver system notification in OS notification shade.
   - Terminated / Cold-Start: Parse initial notification payload on boot and navigate to deep-link target.
4. **Android Notification Channels**:
   - Configure explicit notification channels (`importance: Importance.max` for urgent alerts, default for marketing).
   - Set custom icons and notification sounds properly per channel.
5. **Deep-Link Navigation**:
   - Parse payload data (e.g. `route: "/orders/123"`) and navigate using router (GoRouter / React Navigation).
