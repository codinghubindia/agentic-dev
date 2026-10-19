# Mobile Sub-Role: Mobile Screens & Navigation

Consolidated from `mobile-screen-worker`.

## Responsibilities & Standards
- Architect Flutter or React Native screens, gesture navigation, animations, and touch-optimized ergonomics.

## Mobile Screen Checklist
- [ ] Touch Targets: All interactive buttons and touch zones must measure at least 48x48dp.
- [ ] Safe Area Handling: Wrap edge-to-edge screens in `SafeArea` to respect notches, dynamic islands, and home indicator bars.
- [ ] Platform Conventions: Adaptive controls (Cupertino widgets on iOS, Material 3 on Android).
- [ ] Keyboard Dismissal: Tapping outside text fields automatically dismisses soft keyboards without obscuring submit buttons.
- [ ] Navigation Stacks: Deep-linking enabled with GoRouter (Flutter) or React Navigation v6/v7 with typed route params.
- [ ] Pull-to-Refresh: List screens provide pull-to-refresh and infinite scroll loading indicators.
