# Plan 10 — Android app (Capacitor) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the same Vue app as an Android app via Capacitor (spec §3 "Android later via Capacitor"), built locally as a debug APK and tested on this machine with Waydroid. The owner asked for this on 2026-11-11.

**Architecture:** Capacitor wraps `dist/` in a native WebView. The only code changes are where the web build relies on browser-only behaviour:
1. **File downloads** (Backup, deck export) use a Blob link, which doesn't work in a WebView. A new core helper `saveTextFile(name, text, mime)` writes to the cache directory and opens the share sheet on native, and keeps the Blob download on the web.
2. **The Android back button** goes back in the router, and exits the app from Home.
3. **Safe areas** for the status bar and gesture bar (already partly in `base.css`).
Storage stays on localStorage (the decision log: it works in the Capacitor WebView).

**Tech:** `@capacitor/core`, `@capacitor/android`, `@capacitor/cli` **8.5.3** (pinned; 8.6.0 was under two weeks old), plus `@capacitor/filesystem`, `@capacitor/share` and `@capacitor/app` at compatible 8.x versions at least two weeks old. Android SDK command-line tools and **JDK 21** are installed **inside the user's home directory** (no root, nothing system-wide): `~/Android/Sdk` and `~/.local/share/jdk-21`.

## Global Constraints
- appId `io.github.mrraven07.memorizethis` (the owner has no domain, so this uses their GitHub namespace). appName `MemorizeThis`. webDir `dist`.
- The web build and all 335+ tests keep working unchanged. Native-only code paths sit behind `Capacitor.isNativePlatform()` and are tested with mocks.
- The `android/` project is committed (Capacitor's recommended practice), except build outputs, which are ignored by its own `.gitignore`.
- Branch `feat/android` from `feat/cleanup`. Push when the APK builds and the smoke test on Waydroid passes (or is documented as blocked, with the reason).

## Review Focus
1. **Backup and export on Android** go through the share sheet; on the web, the Blob download is unchanged. Pinned in Task 1 (mocked).
2. **Back button:** on Home it exits; elsewhere it navigates back; mid-round it quits the game like the Quit button (rounds aren't recorded). Pinned in Task 2.
3. **The status bar and notch don't overlap the header.** `viewport-fit=cover` plus `env(safe-area-inset-*)` padding; checked manually on Waydroid.
4. **No `crypto.randomUUID` gaps on old WebViews** (Android System WebView before Chrome 92). Pinned in Task 2 (a fallback id generator).
5. **The web build stays unaffected:** the full suite plus `npm run build`.

---

### Task 1: `saveTextFile` helper
**Files:** `src/core/platform/saveFile.ts` (+ test). Change `SettingsView` (backup) and `DeckView` (export) to use it.
- [ ] RED: on the web (`isNativePlatform` false) it creates a Blob URL, clicks an `<a download>` and revokes the URL (via mocks of `URL.createObjectURL` and the anchor click). On native, `Filesystem.writeFile({ path, data, directory: Cache, encoding: UTF8 })` is called and `Share.share({ files: [uri] })` is called with the returned URI (`vi.mock('@capacitor/core')`, `vi.mock('@capacitor/filesystem')`, `vi.mock('@capacitor/share')`).
- [ ] GREEN, then commit.

### Task 2: Back button, ids, safe areas
**Files:** `src/core/platform/backButton.ts` (`installBackButton(router, app)`: route name `home` → `App.exitApp()`, otherwise `router.back()`, or Home when there's no history), called from `main.ts` on native only. `src/core/id.ts` (`newId()`: `crypto.randomUUID` when available, otherwise an RFC 4122 v4 from `crypto.getRandomValues`), replacing the direct `crypto.randomUUID()` calls. `base.css` safe-area padding.
- [ ] RED: the back-button handler at home exits; at `/stats` it calls back; with no history it goes home. `newId()` without `randomUUID` returns a v4-shaped id.
- [ ] GREEN, then commit.

### Task 3: Capacitor project + build
- [ ] Install the pinned packages; add `capacitor.config.ts`; `npx cap add android`; set the app icon colour and theme (the dark background) in `android/app/src/main/res/values` (styles/colors).
- [ ] Install JDK 21 + Android SDK (cmdline-tools, platform-tools, the platform and build-tools Capacitor 8 needs) into the home directory; write `android/local.properties` (ignored).
- [ ] `npm run build && npx cap sync android && ./gradlew assembleDebug` → `android/app/build/outputs/apk/debug/app-debug.apk`.
- [ ] npm scripts: `android:sync`, `android:build`. README section "Android app" (prerequisites, build, install). Commit.

### Task 4: Smoke test on Waydroid
- [ ] Start the Waydroid session, install the APK, launch it, take screenshots of Home / a game / Settings (`waydroid shell` → `screencap`, or adb over Waydroid's IP), and check: the app starts, games play, the back button works, and backup opens the share sheet.
- [ ] Record the results in the ledger and the decision log; push `feat/android`.
