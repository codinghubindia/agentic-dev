# Micro-Skill: Internationalization (i18n) & RTL Layouts

**Scope**: Translation keys, number/date formatting, and bidirectional layouts.

## Rules & Checklists
1. **Zero Hardcoded Strings**:
   - Every user-facing UI label, button text, and tooltip must use translation lookup: `t('common.save')`.
   - Never concatenate translated fragments (`t('hello') + ' ' + name`); use interpolation: `t('greeting', { name })`.
2. **Modular Namespaces**:
   - Split translation JSON into domain namespaces (`auth.json`, `dashboard.json`, `settings.json`, `errors.json`).
3. **Rich Text Formatting**:
   - Use `<Trans>` components when text contains inline links, bold tags, or formatted markup.
4. **Intl APIs**:
   - Format currencies with `Intl.NumberFormat(locale, { style: 'currency', currency })`.
   - Format timestamps with `Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' })`.
5. **CSS Logical Properties (RTL Support)**:
   - Use `margin-inline-start` instead of `margin-left`.
   - Use `padding-inline-end` instead of `padding-right`.
   - Use `inset-inline-start` instead of `left`.
   - Mirror directional icons (arrows, chevrons) when `dir="rtl"`.
