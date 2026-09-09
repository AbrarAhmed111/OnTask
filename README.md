# Next.js + TypeScript + Supabase Template

A modern Next.js (App Router) template with TypeScript, Tailwind CSS, Redux Toolkit, and first-class Supabase integration (SSR-safe clients, auth middleware, and helpers).

This README documents only the template. Any auxiliary folders (e.g. `nizam-web`) are not part of this template and can be ignored.

## 🚀 Features

- **Next.js 15** (App Router) + **TypeScript**
- **Supabase** integration:
  - SSR-safe clients for server and browser
  - Middleware to refresh sessions and gate routes
  - Server auth helpers (`getCurrentUser`, `requireAuth`)
- **Tailwind CSS** styling
- **Redux Toolkit** state management
- **ESLint + Prettier + Jest** for quality

## 📦 Directory Structure

```
src/
├── app/                          # Next.js App Router
│   ├── error.tsx
│   ├── layout.tsx
│   ├── not-found.tsx
│   └── page.tsx
├── assets/
│   └── css/
│       └── globals.css
├── components/
│   └── guards/
│       └── AuthGate.tsx          # Client-side auth gate (optional)
├── lib/
│   ├── auth/
│   │   ├── index.ts              # getCurrentUser / requireAuth
│   │   └── signout.ts            # clientSignout
│   └── supabase/
│       ├── client.ts             # Browser client
│       ├── server.ts             # Server client (SSR cookies)
│       └── middleware.ts         # Routing + session refresh
├── middleware.ts                 # App middleware -> uses supabase/middleware
├── store/                        # Redux Toolkit store and providers
└── utils/                        # Utilities (e.g., axios config)
```

## 🔐 Environment Variables

Create `.env.local` in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Optional (only if you plan to use maintenance mode in middleware):

```env
# Configure Edge Config separately in Vercel and add its token to your env if needed
```

## 🧰 Supabase Usage

- Server components or server actions:

```ts
import { createClient } from '@/lib/supabase/server'

export async function getData() {
  const supabase = await createClient()
  const { data } = await supabase.from('users').select('*')
  return data
}
```

- Client components:

```ts
import { createClient } from '@/lib/supabase/client'

export function MyClientComponent() {
  const supabase = createClient()
  // use supabase on the client
  return null
}
```

- Protect server routes (layouts/pages):

```ts
import { requireAuth } from '@/lib/auth'

export default async function ProtectedLayout({ children }) {
  await requireAuth()
  return <>{children}</>
}
```

- Optional client-side protection:

```tsx
import { AuthGate } from '@/components/guards/AuthGate'

export default function Page() {
  return (
    <AuthGate>
      <div>Protected content</div>
    </AuthGate>
  )
}
```

## 🔒 Middleware

- `src/middleware.ts` delegates to `src/lib/supabase/middleware.ts` to:
  - Keep Supabase sessions fresh
  - Redirect unauthenticated users to sign-in/welcome
  - Optionally support admin subdomain and maintenance mode (if configured)

No configuration is required beyond Supabase env vars for basic auth gating.

## ▶️ Getting Started

```bash
npm install
npm run dev
# visit http://localhost:3000
```

## 📜 Scripts

- `npm run dev` – Start development server
- `npm run build` – Build for production
- `npm run start` – Start production server
- `npm run lint` – Lint with ESLint
- `npm run format` – Format with Prettier
- `npm run test` – Run tests

## 🚀 Deploy

Deploy to Vercel:
1. Push to a Git repository
2. Import the project in Vercel
3. Add env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
4. Deploy

## 📄 License

MIT