# Tutor Diagnostic

Maths diagnostic test app for tutors. Tutors create their own accounts, create diagnostic tests, share a public `/test/:slug` link with students, review submitted results, generate tutor reports, generate separate learning plans, and download each document as its own PDF.

## Local Setup

Prerequisites:

- Node.js 20+
- A Firebase project with Firestore enabled
- A Gemini API key

Install and run:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment

Create `.env.local` from `.env.example`:

```bash
cp .env.example .env.local
```

Required:

- `VITE_GEMINI_API_KEY`: used by the AI question-generation service.
- `APP_URL`: the deployed site URL, for example `https://diagnostics.yourdomain.com`.

Firebase config currently lives in `firebase-applet-config.json`. For a production app, replace the AI Studio Firebase project with your own Firebase project before launch.

## Scripts

```bash
npm run dev       # local dev server
npm run lint      # TypeScript check
npm run build     # production build
npm run preview   # preview built app
```

## Public Sharing

The student-facing URL format is:

```text
https://your-domain.com/test/<test-slug>
```

Create or edit a test in `/tests`, then use the copy button to copy the public student link.

## Production Readiness

See [COMMERCIAL_LAUNCH_CHECKLIST.md](./COMMERCIAL_LAUNCH_CHECKLIST.md) before deploying this on a public custom domain. The current prototype needs tutor account creation, private Firestore rules, server-side AI API calls, and separate report and learning-plan PDF workflows before it is safe for commercial use with student data.
