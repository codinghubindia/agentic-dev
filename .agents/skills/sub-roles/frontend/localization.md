# Frontend Sub-Role: Internationalization (i18n) & Localization

Consolidated from `localization-worker`.

## Responsibilities & Standards
- Implement i18n infrastructure (i18next, react-i18next).
- Guarantee zero hardcoded display strings and full support for RTL layouts and locale formatting.

## Localization Checklist
- [ ] Zero Hardcoded Strings: All user-facing text uses translation keys (`t('auth.login_button')`).
- [ ] Translation Namespaces: Group strings into modular JSON files (`common.json`, `auth.json`, `dashboard.json`, `errors.json`).
- [ ] Rich Text Interpolation: Use `<Trans>` components for strings containing links, bold text, or custom styling.
- [ ] Pluralization & Interpolation: Correctly handle count-dependent strings (`{{count}} item`, `{{count}} items`).
- [ ] Locale Formatting: Use native `Intl` API for dates (`Intl.DateTimeFormat`), currencies (`Intl.NumberFormat`), and relative times.
- [ ] RTL Support: Use CSS logical properties (`margin-inline-start`, `padding-inline-end`, `inset-inline-start`) instead of `left`/`right`.
- [ ] Missing Key Fallbacks: Gracefully fall back to English (`en`) when a key is missing in the active locale.
