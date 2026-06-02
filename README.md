# The Kitchen Table

Advisory teacher dashboard built with React, Supabase, and Tailwind CSS.

## Project setup

- React + Vite + TypeScript frontend
- Tailwind CSS for styling
- Supabase backend support via `@supabase/supabase-js`
- Supabase schema defined in `supabase/migrations/0001_init.sql`

## What’s included

- Dashboard scaffold in `src/components/TeacherDashboard.tsx`
- Supabase client wrapper in `src/lib/supabaseClient.ts`
- Type definitions in `src/lib/types.ts`
- Environment example in `.env.example`

## Local development

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env` and set your Supabase URL and anon key.
3. Run the app: `npm run dev`

## Supabase auth

- The app now supports email/password login using Supabase Auth.
- Users sign in at the login screen and are redirected to the dashboard on success.

## Next step

Review the dashboard experience and let me know if you want teacher profile auth, sign-up flows, or role-based access next.
