# SpendBook V2

A beautifully designed personal finance ledger for Indian families. One codebase → website, installable PWA, and native Android/iOS apps (Capacitor).

**Design language — "VOLT LEDGER":** dark-first, five layered moss-black surfaces with Raycast-style backlights and traveling-light button borders, one acid-lime **volt** accent (`#D6F62F`) used sparingly, mint for Cash In / ember for Cash Out, Linear-style atmospheric glow on every route change. Typography: **Instrument Serif** display + **Plus Jakarta Sans** body + **JetBrains Mono** tabular rupee amounts. Light mode is a separately designed "daylight paper" experience, and every chart color is colorblind/contrast-validated per theme.

---

## 1 · Fill in environment variables

```bash
copy .env.local.example .env.local     # Windows
# cp .env.local.example .env.local     # macOS/Linux
```

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → `anon` `public` key |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google Cloud Console → Credentials (reuse the old SpendBook OAuth client) |
| `NEXT_PUBLIC_APP_URL` | The public URL where you deploy the web app (used to build share links) |

## 2 · Set up Supabase

1. Create a project at [supabase.com](https://supabase.com) (or reuse one).
2. **SQL Editor → New query**:
   - **Fresh project:** paste the entire contents of **`supabase/schema.sql`** → Run. This creates `users`, `books`, `payment_methods`, `transactions`, `savings_goals`, `splits`, the `receipt_url` column, the private **receipts** storage bucket + its folder-scoped policies, all indexes, **all RLS policies**, and enables Realtime on `books` + `transactions`.
   - **Already ran the original schema?** Run only **`supabase/schema-v2-additions.sql`** — it adds the v2 features (receipts column, `savings_goals`, `splits`, storage bucket + policies) without touching existing data.
   - **Upgrading to v3?** Run **`supabase/schema-v3-additions.sql`** as well — it adds `wallet_documents` + the private **wallet** storage bucket, `profile_links` with a public-read policy, and a public profile read on `users` (with a column-level grant so anonymous visitors can only ever see `display_name` and `photo_url`, never emails).
   - Storage note: the `receipts` **and** `wallet` buckets are **private** (`public: false`); users can only read/write files under `{bucket}/{their-user-id}/…`, and the app displays images through short-lived signed URLs. If you prefer clicking over SQL, create each bucket in **Dashboard → Storage → New bucket** (Public **off**) and run just its four `storage.objects` policies from the additions files.
   - **Public profile URL:** every user gets a shareable Linktree-style page at `NEXT_PUBLIC_APP_URL/u/<user-id>` (the "Share profile" button on the Links page copies it). It shows only links marked Public — no login needed.
3. **Authentication → Providers → Google** → enable it.
   - Paste your Google **Client ID** and **Client Secret** (from the old SpendBook Google Cloud Console project).
   - In Google Cloud Console, add Supabase's callback to *Authorized redirect URIs*: `https://<your-project-ref>.supabase.co/auth/v1/callback`.
4. **Authentication → URL Configuration** → set *Site URL* to your deployed URL and add `http://localhost:3000` to *Redirect URLs* for local dev.

## 3 · Run as web / PWA

```bash
npm install
npm run dev        # http://localhost:3000
```

Production:

```bash
npm run build
npm start
```

Deploy to Vercel/Netlify/any Node host. The service worker (next-pwa) is generated on production builds — visiting the deployed site offers **Add to Home Screen**; static assets are cached and an offline fallback page is served when disconnected. *(The SW is intentionally disabled during `npm run dev`.)*

## 4 · Build Android APK (Capacitor)

> **Architecture note:** the app uses Next.js App Router **dynamic routes** (`/book/[id]`, `/shared/[shareId]`), which need a server and cannot be fully exported as static files. The native shells therefore load your **deployed web app** (standard Capacitor "server.url" pattern) and still get a native share sheet, deep links, and an app icon; offline behaviour comes from the PWA service worker.

1. Deploy the web app (step 3) and put its URL into `capacitor.config.ts` → `server.url`.
2. Create the (placeholder) web dir Capacitor expects, then add the platform:

```bash
npm run build
mkdir out && echo ok > out/index.html      # webDir placeholder; the shell loads server.url
npx cap add android
npx cap sync
```

3. Open and build:

```bash
npx cap open android
# In Android Studio: Build → Generate Signed Bundle / APK → APK
```

CLI alternative (debug APK): `cd android && .\gradlew assembleDebug` → `android/app/build/outputs/apk/debug/app-debug.apk`.

**Deep links:** the app listens for `spendbook://shared/<shareId>`. Register the scheme in `android/app/src/main/AndroidManifest.xml` inside the main `<activity>`:

```xml
<intent-filter>
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="spendbook" android:host="shared" />
</intent-filter>
```

## 5 · Build iOS IPA (Capacitor)

Requires a Mac with Xcode.

```bash
npx cap add ios
npx cap sync
npx cap open ios
```

In Xcode: select your team under *Signing & Capabilities* → **Product → Archive** → *Distribute App* to export the IPA. For the `spendbook://` scheme, add a URL Type with scheme `spendbook` in the target's *Info* tab.

---

## Feature map

- **Digital wallet (vault)** — store PAN, Aadhaar, license, passport, voter ID and insurance as physical-looking cards with front/back capture (camera on mobile, upload on desktop), full-screen viewer with pinch/scroll zoom, download, and a private `wallet` storage bucket.
- **Profile links** — a Linktree in your ledger: every social/professional link with public/private toggles, drag-to-reorder, and a stunning shareable public page at `/u/<user-id>`.
- **Rich Settings** — inline display-name editing, member-since, live account stats (books, transactions, totals) with count-up animation, one-click full-account Excel export (a sheet per book), and a danger-zone account deletion.
- **Global search (Ctrl/⌘+K)** — command-palette overlay searching notes, categories and amounts across every book, grouped by book, full keyboard navigation; selecting a result deep-links into the book and flash-highlights the row.
- **Insights** — cross-book monthly hero (spent/earned/net with % change vs last month), biggest category, top-3 categories with proportional bars, 6-month chart, best/worst month callouts.
- **Savings goals** — rich goal cards with animated progress in the goal's color, add/withdraw funds, optional deadline, and a confetti "Goal reached!" celebration.
- **Split expenses** — split any Cash Out among named people with equal or manual shares, per-person "paid back" toggles, a Split badge on rows, and a "You are owed ₹X" card per book.
- **Photo receipts** — attach a camera/gallery photo to any transaction (stored privately in Supabase Storage), thumbnail + full-screen viewer, camera icon on rows.
- **Books** — colored, emoji-tagged ledgers with live In/Out/Net stats, optional monthly budget with 80%/100% warning states, cascade delete.
- **Transactions** — Cash In/Out toggle, Indian-formatted amount input, 13 categories, payment-method picker, notes, date, recurring (daily/weekly/monthly/yearly) with automatic catch-up on app load, filters (type/category/date range), swipe or long-press to delete, infinite scroll, pull-to-refresh.
- **Payment methods** — 3-step stepper (bank → type → details), 15 banks, 12 UPI apps, custom "Other" entries, duplicate detection with grayed-out UPI apps, "Deleted Method" fallback in history.
- **Dashboard** — summary cards, 6-month grouped bar chart, category donut (top 5 + Other), budget meter.
- **Sharing** — UUID share codes, copy/system-share, stop/reset link, public read-only **live** view (Supabase Realtime), enter-code screen without login.
- **Export** — PDF (jsPDF, styled report) and Excel (xlsx) honoring the active filter range. *(PDF uses "Rs." since standard PDF fonts lack the ₹ glyph.)*
- **Theming** — Light/Dark/System with pre-hydration bootstrap (no flash), animated switch, per-theme validated chart palette.
- **Keyboard** — `N` for new book, `Ctrl/⌘+K` for search, `Esc` closes any dialog/sheet, arrows + Enter inside search.
- **Motion system** — route-change atmospheric glow, traveling-light borders on primary actions, card lift + backlight on hover, left→right row sweeps, count-up rupee amounts, sliding sidebar indicator, breathing empty-state illustrations, smooth theme morph.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | dev server |
| `npm run build` / `npm start` | production |
| `npm run typecheck` | strict TS check |
| `npm run icons` | regenerate PWA icons (zero-dependency PNG generator) |
| `npm run cap:sync` / `cap:android` / `cap:ios` | Capacitor |
