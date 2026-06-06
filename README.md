# Local App Sri Lanka

A professional Sri Lankan local events, landmarks, attractions, and ticketing platform built with **Next.js App Router**, **Firebase**, **Tailwind CSS**, and **Google Maps**.

## Stack

- Next.js 16 (App Router) + **JavaScript (JSX)** — no TypeScript
- Firebase Auth, Firestore, Storage, Cloud Functions
- Google Maps JavaScript API
- Tailwind CSS v4 + Lucide React icons
- Inter + Noto Sans Sinhala fonts
- **Single theme file:** `lib/theme.js` → CSS variables in `app/globals.css`

## Project Structure

```
├── app/                    # Next.js pages (App Router)
│   ├── admin/              # Admin dashboard
│   ├── events/             # Event listing, detail, create, chat
│   ├── places/             # Landmarks & attractions
│   ├── map/                # Discovery map
│   ├── search/             # Search
│   ├── profile/            # User profile & my events
│   ├── wallet/             # Wallet & top-up
│   └── tickets/            # Ticket QR codes
├── components/             # UI, layout, maps, events, places
├── lib/
│   ├── theme.js            # ★ Single design system (colors, radius, shadows)
│   ├── firebase/           # Client & admin SDK
│   ├── services/           # Firestore service layer
│   ├── types/              # (removed — plain JS objects)
│   └── utils/              # Geohash, SEO, slug helpers
├── providers/              # AuthProvider
├── functions/              # Firebase Cloud Functions
├── config.js               # Central app configuration (no .env)
├── firestore.rules         # Security rules
├── firestore.indexes.json  # Composite indexes
└── storage.rules           # Storage security rules
```

## Setup

### 1. Configure Firebase & Google Maps

Edit **`config.js`** at the project root with your credentials:

```js
const config = {
  siteUrl: "http://localhost:3000",
  googleMapsApiKey: "YOUR_GOOGLE_MAPS_API_KEY",
  firebase: {
    apiKey: "...",
    authDomain: "...",
    projectId: "...",
    storageBucket: "...",
    messagingSenderId: "...",
    appId: "...",
  },
  firebaseAdmin: {
    projectId: "YOUR_PROJECT_ID",
    serviceAccountPath: "./service-account.json", // optional
  },
};
```

### 2. Firebase Console Setup

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Authentication** sign-in providers: **Google** and **Email/Password** (Phone auth is **not** used — OTP is sent via Notify.lk)
3. Create **Firestore** database (production mode)
4. Enable **Storage**
5. Upgrade to **Blaze plan** for Cloud Functions

**Phone OTP (Notify.lk):**

Vendor onboarding sends a 6-digit OTP via [Notify.lk](https://www.notify.lk). Configure in **Admin → Settings → Notify.lk SMS** (or set env vars `NOTIFYLK_USER_ID`, `NOTIFYLK_API_KEY`, `NOTIFYLK_SENDER_ID` on Cloud Functions).

1. Create an account at [notify.lk](https://www.notify.lk)
2. Copy **User ID** and **API key** from the Notify.lk dashboard
3. Use `NotifyDEMO` sender for testing only; request an approved **Sender ID** for production OTPs
4. Deploy Cloud Functions after saving settings: `npm run firebase:deploy:functions`

If Notify.lk is not configured, OTP codes are logged in Cloud Functions logs (dev only) so you can still test verification.

### 3. Deploy Firestore Rules & Indexes

```bash
npm install -g firebase-tools
firebase login
firebase use YOUR_PROJECT_ID
firebase deploy --only firestore:rules,firestore:indexes,storage
```

### 4. Deploy Cloud Functions

```bash
cd functions
npm install
npm run build
cd ..
firebase deploy --only functions
```

### 5. Create First Admin User

1. Register via the app at `/register`
2. In Firebase Console → Firestore → `users/{uid}` → set `role: "admin"`

### 6. Run Development Server

```bash
npm install
npm run dev
```

## Theming

All colors, radii, and shadows are defined in **`lib/theme.js`**. The same values are mirrored as CSS custom properties in **`app/globals.css`** (`:root` block).

To rebrand the app, edit `lib/theme.js` and update the matching `--color-*` variables in `globals.css`. Components use tokens like:

```jsx
className="bg-[var(--color-primary)] text-[var(--color-primary-fg)]"
```

Never hardcode hex colors in components — always use theme variables.

Open [http://localhost:3000](http://localhost:3000)

### 7. Deploy to Vercel (recommended)

```bash
npm run build
```

Connect repo to Vercel. No environment variables needed — all config is in `config.js`.

For SSR pages, set `firebaseAdmin.serviceAccountPath` or use Vercel's Google Cloud integration with Application Default Credentials.

## Features

| Module | Description |
|--------|-------------|
| **Events** | Create, moderate, geo-search, featured/today/nearby feeds |
| **Places** | Landmarks & attractions with SEO slugs |
| **Reviews** | Attraction ratings with Cloud Function aggregation |
| **Chat** | Real-time event group chat with join policies |
| **Wallet** | LKR balance, top-up, in-app ticket purchase |
| **Tickets** | QR code generation for paid events |
| **Admin** | Dashboard, moderation, CRUD, settings, audit logs |

## Performance

- Geohash-based geo queries with composite Firestore indexes
- Paginated queries with `limit` (default 12 items)
- Server Components + `generateMetadata` for SEO pages
- Client components only for maps, chat, auth, forms
- Parallel `Promise.all` for home page data loading

## Cloud Functions

| Function | Type | Purpose |
|----------|------|---------|
| `expireOldEvents` | Scheduled (hourly) | Expire free events 24h after end |
| `moderateEvent` | Callable | Admin approve/reject/feature |
| `purchaseTicket` | Callable | Transaction-safe wallet deduction |
| `topUpWallet` | Callable | Wallet top-up |
| `updateAttractionRating` | Firestore trigger | Recalculate ratings |
| `initUserWallet` | Firestore trigger | Create wallet on signup |

## Security

- Role-based access: `user`, `vendor`, `admin`
- Events created as `pending` only; admin approves
- Wallet/transactions/tickets writable only via Cloud Functions
- Chat restricted to active group members
- Places writable by admin only

## License

Private — Local App Sri Lanka
