<<<<<<< pushForSettlement
> **Status: Proposed — not yet implemented.**

=======
>>>>>>> develop
# Android Build Optimization Plan (Size + Speed)

## Context
The app ships as a Capacitor WebView hybrid. The Android release build has minification disabled, and several Vite-level and asset-level optimizations are missing. Goal: reduce APK size and improve startup/runtime speed without changing app behavior.

---

## Changes

### 1. Enable R8 Minification + Resource Shrinking — `android/app/build.gradle`
Biggest single win. R8 dead-code-eliminates unused Java/Kotlin and shrinks string pools.

```gradle
buildTypes {
    release {
        minifyEnabled true
        shrinkResources true  // requires minifyEnabled true
        proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
    }
}
```

Switch from `proguard-android.txt` → `proguard-android-optimize.txt` (more aggressive optimizations enabled).

Also add ABI splits to generate per-architecture APKs (arm64-v8a covers ~95% of modern devices):

```gradle
splits {
    abi {
        enable true
        reset()
        include 'arm64-v8a', 'armeabi-v7a', 'x86_64'
        universalApk false
    }
}
```

### 2. ProGuard rules — `android/app/proguard-rules.pro`
R8 can break Capacitor reflection and Supabase JSON deserialization. Add keep rules:

```
# Capacitor
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }

# WebView JS bridge
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Kotlin coroutines (used by Capacitor plugins)
-dontwarn kotlinx.coroutines.**
```

### 3. Vite build optimizations — `vite.config.ts`
Add explicit minification settings and target:

```ts
build: {
  target: 'es2020',        // matches Android WebView 96+ (Chrome/Chromium base)
  minify: 'esbuild',       // esbuild is default but explicit is clearer
  cssMinify: true,
  reportCompressedSize: false,  // avoids gzip calculation, irrelevant for Capacitor
  rollupOptions: {
    output: {
      // existing manualChunks stay as-is
      compact: true,        // compact output (removes whitespace in Rollup output)
    }
  }
}
```

### 4. Self-host the Nunito font — `index.html` + `public/fonts/`
Currently loaded from Google Fonts CDN (HTTP request during startup). For a Capacitor app this is a cold network request on every launch.

- Download Nunito subsets: weights 400, 600, 700 (drop 500 and 800 if unused in Tailwind config)
- Place `.woff2` files in `public/fonts/`
- Replace the `<link href="https://fonts.googleapis.com/...">` tags with a local `@font-face` block in `src/index.css`
- Add `<link rel="preload" as="font" type="font/woff2" crossorigin href="/fonts/Nunito-Regular.woff2">` for the 400 weight in `index.html` (critical path font)

### 5. Lazy-load the two eager pages — `src/router/index.tsx`
`HomePage` and `GroupsPage` are currently eagerly imported. Make them lazy (same pattern as every other page):

```ts
const HomePage = lazy(() => import('@pages/HomePage'));
const GroupsPage = lazy(() => import('@pages/GroupsPage'));
```

`AppShell` should stay eager (it is the layout shell, rendered immediately).

---

## Files to Modify
| File | Change |
|------|--------|
| `android/app/build.gradle` | Enable `minifyEnabled`, `shrinkResources`, add ABI splits |
| `android/app/proguard-rules.pro` | Add Capacitor + WebView keep rules |
| `vite.config.ts` | `target`, `cssMinify`, `compact`, `reportCompressedSize` |
| `index.html` | Remove Google Fonts links, add font preload |
| `src/index.css` | Add `@font-face` for self-hosted Nunito |
| `src/router/index.tsx` | Lazy-load `HomePage` and `GroupsPage` |
| `public/fonts/` | Add Nunito `.woff2` files (download step) |

---

## Verification
1. `npm run build` — must complete without errors; check chunk sizes in output
2. Build release APK: `cd android && ./gradlew assembleRelease`
3. Verify app launches and all routes work (R8 can break reflection — test barcode scan, push notifications, deep links)
4. Compare APK size before/after (expected: 20–40% reduction from R8 alone)
5. Check font renders correctly on first launch (no FOUT)
6. Run `npx tsc --noEmit` — no type errors
