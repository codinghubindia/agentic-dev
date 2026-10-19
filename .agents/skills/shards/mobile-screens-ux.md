# Micro-Skill: Mobile Screens & Touch UX

**Scope**: Mobile screen architecture, responsive layout, touch targets, and platform adaptation.

## Rules & Checklists
1. **Touch Target Dimensions**:
   - Every tappable control (buttons, icons, list items) must be at least 48x48dp / pt.
   - Provide visual touch feedback (ripple or opacity fade) on tap down.
2. **Safe Area & Display Cutouts**:
   - Wrap top-level screens in `SafeArea` / `useSafeAreaInsets()` to clear notches, home indicators, and status bars.
   - Account for dynamic software keyboard: Use `KeyboardAvoidingView` or `SingleChildScrollView(reverse: true)` to keep active inputs visible.
3. **Adaptive Platform Styling**:
   - Adhere to platform conventions: Material 3 for Android, Cupertino styling / iOS navigation bars for iOS where appropriate.
   - Support dark mode and dynamic theme changes without requiring app restarts.
4. **Frame Rate & Thread Safety**:
   - Keep the main UI thread free of heavy JSON parsing or crypto hashing; delegate to Flutter Isolates or background tasks.
   - Avoid rebuilding entire widget trees on localized state changes.
5. **Offline & Connectivity Indicators**:
   - Provide a persistent, non-intrusive offline banner when network connectivity drops.
