---
name: ponytail
description: The Ladder of Laziness & Anti-Overengineering Protocol. Mandates YAGNI, standard library usage, native web platform features, and minimal diffs. Bans package sprawl.
lastResearched: 2026-10-01
---

# 🧘 Ponytail: The Ladder of Laziness & Anti-Overengineering Protocol

> [!IMPORTANT]
> **The Non-Negotiable Rule**: AI models have an innate bias to over-engineer, create deep abstract class hierarchies, and install 5 npm libraries for a 10-line task. This skill enforces ruthless simplicity.

## The Ladder of Laziness (Decision Hierarchy)

Before writing any new class, helper file, or third-party dependency, you MUST climb the ladder:

1. **Step 1: Does this strictly need to exist? (YAGNI)**  
   If the requirement can be achieved without this code, **do not write it**. Delete unused parameters, speculative features, and dead code immediately.

2. **Step 2: Is it already in the codebase?**  
   Reuse existing utility functions, component primitives, and database models. Never duplicate what already exists.

3. **Step 3: Does the language Standard Library support it?**  
   - Need UUIDs? Use `crypto.randomUUID()` instead of `npm install uuid`.
   - Need dates? Use `Intl.DateTimeFormat` or native `Date` instead of `moment` or `date-fns`.
   - Need URL parsing? Use native `URL` and `URLSearchParams`.
   - Need HTTP requests? Use native `fetch()` instead of `axios`.

4. **Step 4: Does the native web/browser platform have it?**  
   - Need a modal dialog? Use native `<dialog>` element with `.showModal()`.
   - Need date selection? Use `<input type="date">`.
   - Need an accordion/collapsible? Use `<details>` and `<summary>`.
   - Need tooltips? Use standard `title` or simple CSS peer hover.

5. **Step 5: Does an already installed dependency do it?**  
   Never install a new package if a package in `package.json` already fulfills the requirement.

6. **Step 6: Can it be written in under 10 lines of code?**  
   If a helper can be expressed in 5–10 lines of pure, clear code, write the 5 lines inline. Do not create a separate file and abstract class for a one-liner.

7. **Step 7: ONLY THEN write minimal custom logic.**  
   Keep custom implementations strictly scoped, pure, and minimal.

---

## The Hard Anti-Package Sprawl Rule
* Workers are **strictly barred** from running `npm install <package>` or `pip install <package>` without explicit authorization from the Conductor.
* Adding a dependency to `package.json` when a native alternative exists is an **instant QA gate failure**.

## Minimal Diff Standard
* Never rewrite an entire 500-line file to change 4 lines.
* Use targeted line replacements (`replace_file_content`) or structural AST surgery (`ast_surgery.py`).
* Preserve existing comments, code styling, and indentations.
