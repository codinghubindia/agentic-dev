---
name: localization
description: Internationalization (i18n) and localization (l10n) guide covering i18next and react-i18next setup, Flutter Intl and ARB files, translation namespace design, string extraction patterns, plural rules, interpolation, Trans component for rich text, locale-aware Intl formatting (dates, numbers, currencies), locale switching with direction toggling (LTR/RTL), logical CSS properties for RTL layout, and localization quality checklist.
refreshMode: sections
lastResearched: 2026-09-28
refreshableSections:
  - "Library-specific setup"
protectedSections:
  - "Plural rules"
  - "RTL layout"
---

# Localization (i18n / l10n) Skill

Standards for making applications fully translatable, locale-aware, and RTL-capable.

---

## 1. Core Concepts

| Term | Meaning |
|---|---|
| **i18n** (internationalization) | Building the app so it CAN be translated — infrastructure, string extraction, locale switching |
| **l10n** (localization) | Actually translating the content for a specific locale — translation files, formatting rules |
| **Locale** | Language + region: `en-US`, `en-GB`, `fr-FR`, `ar-SA`, `ja-JP` |
| **LTR** | Left-to-right text direction (most languages) |
| **RTL** | Right-to-left text direction (Arabic, Hebrew, Persian, Urdu) |
| **Plural forms** | Different grammatical forms for quantities: "1 item" vs "2 items" |
| **ICU format** | Standard message format for plurals, genders, selects |

---

## 2. Web — i18next Setup (React)

### Installation
```bash
npm install i18next react-i18next i18next-browser-languagedetector i18next-http-backend
```

### Configuration
```typescript
// src/i18n/index.ts — import this BEFORE rendering the app
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import Backend from 'i18next-http-backend';

i18n
  .use(Backend)             // lazy-load translation files via HTTP
  .use(LanguageDetector)    // auto-detect browser locale
  .use(initReactI18next)    // bind to React
  .init({
    fallbackLng: 'en',
    supportedLngs: ['en', 'es', 'fr', 'de', 'ar', 'ja', 'pt', 'zh'],
    defaultNS: 'common',
    ns: ['common', 'auth', 'dashboard', 'errors'],  // one file per feature area
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'preferred-locale',
    },
    interpolation: {
      escapeValue: false,  // React already escapes — don't double-escape
    },
  });

export default i18n;

// src/main.tsx — import i18n BEFORE rendering
import './i18n';
import { Suspense } from 'react';
// Wrap app in Suspense — translations load async
ReactDOM.createRoot(root).render(
  <Suspense fallback={<SplashScreen />}>
    <App />
  </Suspense>
);
```

---

## 3. Translation File Structure

**Rule: one namespace file per feature area, never one monolithic `translations.json`.**

```
public/locales/
  en/
    common.json       ← shared: buttons, nav, time, validation, pagination
    auth.json         ← login, register, forgot-password, reset-password
    dashboard.json    ← dashboard-specific strings
    errors.json       ← error messages, 404, 500, network error
    settings.json     ← settings page
    [feature].json    ← one per major feature
  es/
    common.json
    auth.json
    ...
  ar/
    common.json       ← Arabic (RTL)
    ...
```

### `en/common.json` — canonical reference
```json
{
  "actions": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "edit": "Edit",
    "confirm": "Confirm",
    "back": "Back",
    "next": "Next",
    "done": "Done",
    "loading": "Loading...",
    "retry": "Try again",
    "submit": "Submit",
    "close": "Close",
    "view": "View",
    "create": "Create",
    "search": "Search"
  },
  "nav": {
    "dashboard": "Dashboard",
    "settings": "Settings",
    "profile": "Profile",
    "logout": "Sign out",
    "help": "Help"
  },
  "validation": {
    "required": "This field is required",
    "email": "Please enter a valid email address",
    "minLength": "Must be at least {{count}} characters",
    "minLength_other": "Must be at least {{count}} characters",
    "maxLength": "Must be no more than {{count}} characters",
    "passwordMismatch": "Passwords do not match",
    "url": "Please enter a valid URL"
  },
  "time": {
    "justNow": "Just now",
    "minutesAgo_one": "{{count}} minute ago",
    "minutesAgo_other": "{{count}} minutes ago",
    "hoursAgo_one": "{{count}} hour ago",
    "hoursAgo_other": "{{count}} hours ago",
    "daysAgo_one": "{{count}} day ago",
    "daysAgo_other": "{{count}} days ago"
  },
  "pagination": {
    "previous": "Previous",
    "next": "Next",
    "showing": "Showing {{start}}–{{end}} of {{total}}"
  },
  "empty": {
    "noResults": "No results found",
    "noData": "Nothing here yet"
  }
}
```

---

## 4. Using Translations in Components

```tsx
import { useTranslation, Trans } from 'react-i18next';

// Basic usage
function LoginForm() {
  const { t } = useTranslation('auth');  // specify namespace

  return (
    <form>
      <h1>{t('login.title')}</h1>         {/* auth:login.title */}
      <p>{t('login.subtitle')}</p>
      <button type="submit">{t('login.submit')}</button>
    </form>
  );
}

// Multiple namespaces in one component
function Dashboard() {
  const { t: tc } = useTranslation('common');
  const { t: td } = useTranslation('dashboard');

  return <h1>{td('title')}</h1>;
}

// Pluralization — uses _one / _other suffixes (or ICU format)
function ItemCount({ count }: { count: number }) {
  const { t } = useTranslation('common');
  // In JSON: "items_one": "{{count}} item", "items_other": "{{count}} items"
  return <span>{t('items', { count })}</span>;
}

// Interpolation — pass variables
function ValidationError({ min }: { min: number }) {
  const { t } = useTranslation('common');
  // In JSON: "validation.minLength": "Must be at least {{count}} characters"
  return <p>{t('validation.minLength', { count: min })}</p>;
}

// Rich text with HTML/components — use Trans (not dangerouslySetInnerHTML)
function TermsText() {
  const { t } = useTranslation('auth');
  // In JSON: "register.terms": "I agree to the <termsLink>Terms</termsLink> and <privacyLink>Privacy Policy</privacyLink>"
  return (
    <Trans
      i18nKey="auth:register.terms"
      components={{
        termsLink: <a href="/terms" className="link" />,
        privacyLink: <a href="/privacy" className="link" />,
      }}
    />
  );
}

// ❌ NEVER hardcode any user-facing string
<button>Save</button>         // ❌
<h1>Welcome back!</h1>        // ❌
<p>No results found</p>       // ❌
```

---

## 5. Locale Switcher

```tsx
// components/LocaleSwitcher.tsx
import { useTranslation } from 'react-i18next';

const LOCALES = [
  { code: 'en', label: 'English',    flag: '🇺🇸', dir: 'ltr' as const },
  { code: 'es', label: 'Español',    flag: '🇪🇸', dir: 'ltr' as const },
  { code: 'fr', label: 'Français',   flag: '🇫🇷', dir: 'ltr' as const },
  { code: 'de', label: 'Deutsch',    flag: '🇩🇪', dir: 'ltr' as const },
  { code: 'ar', label: 'العربية',    flag: '🇸🇦', dir: 'rtl' as const },
  { code: 'ja', label: '日本語',      flag: '🇯🇵', dir: 'ltr' as const },
];

export function LocaleSwitcher() {
  const { i18n } = useTranslation();

  const changeLocale = (code: string) => {
    const locale = LOCALES.find(l => l.code === code);
    i18n.changeLanguage(code);
    // IMPORTANT: update HTML attributes for accessibility and browser behavior
    document.documentElement.lang = code;
    document.documentElement.dir = locale?.dir ?? 'ltr';
    localStorage.setItem('preferred-locale', code);
  };

  return (
    <select
      value={i18n.resolvedLanguage}
      onChange={e => changeLocale(e.target.value)}
      aria-label="Select language"
    >
      {LOCALES.map(({ code, label, flag }) => (
        <option key={code} value={code}>{flag} {label}</option>
      ))}
    </select>
  );
}
```

---

## 6. Locale-Aware Formatting (Intl API)

**Never format dates, numbers, or currencies manually. Always use `Intl`.**

```typescript
// utils/format.ts

// Currency
export function formatCurrency(amount: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
// formatCurrency(1234.5, 'USD', 'en-US')  → "$1,234.50"
// formatCurrency(1234.5, 'EUR', 'de-DE')  → "1.234,50 €"
// formatCurrency(1234.5, 'JPY', 'ja-JP')  → "¥1,235"

// Dates
export function formatDate(
  date: Date,
  locale: string,
  options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' }
): string {
  return new Intl.DateTimeFormat(locale, options).format(date);
}
// formatDate(new Date(), 'en-US')  → "September 18, 2026"
// formatDate(new Date(), 'de-DE')  → "18. September 2026"
// formatDate(new Date(), 'ja-JP')  → "2026年9月18日"
// formatDate(new Date(), 'ar-SA')  → "١٨ سبتمبر ٢٠٢٦"

// Relative time ("3 hours ago")
export function formatRelativeTime(date: Date, locale: string): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const diffMs = date.getTime() - Date.now();
  const diffMins = Math.round(diffMs / 60_000);
  const diffHours = Math.round(diffMs / 3_600_000);
  const diffDays = Math.round(diffMs / 86_400_000);

  if (Math.abs(diffMins) < 60) return rtf.format(diffMins, 'minute');
  if (Math.abs(diffHours) < 24) return rtf.format(diffHours, 'hour');
  return rtf.format(diffDays, 'day');
}
// formatRelativeTime(3 hours ago, 'en-US') → "3 hours ago"
// formatRelativeTime(3 hours ago, 'fr-FR') → "il y a 3 heures"
// formatRelativeTime(3 hours ago, 'ar-SA') → "منذ ٣ ساعات"

// Numbers
export function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(value);
}
// formatNumber(1234567, 'en-US') → "1,234,567"
// formatNumber(1234567, 'de-DE') → "1.234.567"
// formatNumber(1234567, 'fr-FR') → "1 234 567"
```

---

## 7. RTL Layout Support

RTL languages (Arabic, Hebrew, Persian) require mirrored layouts.

### Use Logical CSS Properties (auto-mirrors in RTL)
```css
/* ❌ Physical properties — break in RTL */
.element {
  margin-left: 16px;         /* → margin-right in RTL */
  padding-right: 24px;
  border-left: 2px solid;
  text-align: left;
  float: left;
}

/* ✅ Logical properties — auto-mirror in RTL */
.element {
  margin-inline-start: 16px;    /* left in LTR, right in RTL */
  padding-inline-end: 24px;     /* right in LTR, left in RTL */
  border-inline-start: 2px solid;
  text-align: start;            /* left in LTR, right in RTL */
  float: inline-start;
}
```

### RTL-Specific Overrides
```css
/* Only apply when needed */
[dir="rtl"] .icon-arrow {
  transform: scaleX(-1);   /* flip directional icons */
}

[dir="rtl"] .sidebar {
  right: 0;
  left: auto;
}
```

### Testing RTL
```bash
# Set locale to Arabic to test RTL layout
localStorage.setItem('preferred-locale', 'ar');
# Or add ?locale=ar to URL and handle in app init
```

---

## 8. Flutter i18n (ARB Files)

```yaml
# pubspec.yaml
dependencies:
  flutter_localizations:
    sdk: flutter
  intl: ^0.19.0

flutter:
  generate: true  # enables flutter gen-l10n command
```

```yaml
# l10n.yaml (at project root)
arb-dir: lib/l10n
template-arb-file: app_en.arb
output-localization-file: app_localizations.dart
```

```json
// lib/l10n/app_en.arb — template file (always English)
{
  "@@locale": "en",
  "appTitle": "My App",
  "@appTitle": {
    "description": "The application title shown in the app bar"
  },
  "loginTitle": "Welcome back",
  "@loginTitle": {
    "description": "Title on the login screen"
  },
  "itemCount": "{count, plural, =0{No items} =1{1 item} other{{count} items}}",
  "@itemCount": {
    "description": "Item count with plural support",
    "placeholders": {
      "count": { "type": "int", "format": "decimalPattern" }
    }
  }
}
```

```dart
// In MaterialApp
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';

MaterialApp(
  localizationsDelegates: const [
    AppLocalizations.delegate,
    GlobalMaterialLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
    GlobalCupertinoLocalizations.delegate,
  ],
  supportedLocales: const [
    Locale('en'),
    Locale('es'),
    Locale('ar'),
  ],
  // ...
);

// Usage in widgets
final l10n = AppLocalizations.of(context)!;
Text(l10n.loginTitle)
Text(l10n.itemCount(5))  // → "5 items"
```

---

## 9. String Extraction Workflow

When adding localization to an existing codebase:

```bash
# 1. Find all hardcoded strings (grep for JSX text content)
grep -rn '"[A-Z][a-z]' src/ --include="*.tsx"   # "Capital letter strings in TSX
grep -rn "'[A-Z][a-z]" src/ --include="*.tsx"
grep -rn ">[A-Z]" src/ --include="*.tsx"         # JSX text nodes starting with capital

# 2. Find hardcoded strings in Dart
grep -rn "Text('" lib/ --include="*.dart"
grep -rn 'Text("' lib/ --include="*.dart"
```

Process:
1. List all hardcoded strings found by grep
2. Group by feature area → assign to namespace
3. Create translation key (snake_case, descriptive)
4. Add to English ARB/JSON first
5. Replace hardcoded string with `t('key')` or `l10n.key`
6. Repeat for each locale — translate (or use placeholder)
7. Re-run grep to verify no hardcoded strings remain

---

## 10. Localization Checklist

- [ ] i18n library installed and configured
- [ ] All user-facing strings in translation files (grep confirms zero hardcoded)
- [ ] Plural forms handled (not just "s" suffix — use count-based keys)
- [ ] Dates formatted with `Intl.DateTimeFormat` (not `.toString()`)
- [ ] Numbers formatted with `Intl.NumberFormat`
- [ ] Currency formatted with `Intl.NumberFormat` + currency style
- [ ] Locale switcher component implemented and accessible
- [ ] `document.lang` and `document.dir` updated on locale change (web)
- [ ] RTL layout tested with Arabic locale (all directional CSS uses logical properties)
- [ ] Fallback locale (`en`) renders correctly when a key is missing
- [ ] Localization lazy-loads per namespace (no single giant file)
- [ ] Translation keys use snake_case and are grouped by namespace
