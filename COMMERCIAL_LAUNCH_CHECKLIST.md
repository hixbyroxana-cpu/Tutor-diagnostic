# Commercial Launch Checklist

This app is close to a usable prototype, but it is not commercially ready yet. The items below are the practical changes needed before sharing it publicly with students on a custom domain.

## Must Fix Before Public Launch

- Add tutor account creation and login. Every tutor should have their own account, and the dashboard, tests, reports, learning plans, and results routes must require authentication.
- Replace open Firestore rules. `firestore.rules` currently allows anyone to read and write everything.
- Move Gemini calls server-side. The browser bundle currently receives access to `GEMINI_API_KEY` through Vite's `define`, which can expose the key to users. Use a serverless API route or backend service to call Gemini.
- Use your own Firebase project. The committed Firebase config points to an AI Studio-generated project/database.
- Add consent and privacy copy before collecting student names, parent names, parent emails, and assessment data.
- Add deletion/export workflows for student data so you can respond to parent data requests.
- Add abuse controls on public test submission, such as rate limits, duplicate prevention, and basic spam protection.
- Scope all tests, results, reports, and learning plans to the tutor who created them.

## Recommended Before Paid Use

- Add a generated tutor report workflow after a student submits a test. The report should include score, topic breakdown, strengths, weak areas, and suggested targets.
- Add a separate generated learning plan workflow. This should be created independently from the report and turn the targets into lesson priorities, practice topics, and follow-up actions.
- Add separate PDF downloads for the report and the learning plan, so tutors can download each document independently.
- Use tutor- and student-friendly PDF filenames, such as `student-name-diagnostic-report.pdf` and `student-name-learning-plan.pdf`.
- Add slug uniqueness checks so two tests cannot accidentally share the same public URL.
- Keep public test links reusable by default so the same level diagnostic can be used again in future years. Add only a manual active/inactive switch for tests a tutor deliberately wants to retire.
- Improve error messages for students when network or Firebase writes fail.
- Add analytics for test completion rates without tracking unnecessary personal data.
- Add automated tests for result marking and submission flows.

## Vercel Deployment Path

Use Vercel for the frontend and either Vercel Functions or another backend for Gemini calls.

1. Import the GitHub repo into Vercel.
2. Set build command to `npm run build`.
3. Set output directory to `dist`.
4. Add production environment variables:
   - `GEMINI_API_KEY`
   - `APP_URL=https://your-domain.com`
5. Add the custom domain in Vercel project settings.
6. Configure DNS with your domain provider as instructed by Vercel.
7. Add the custom domain to Firebase Authentication authorized domains if Firebase Auth is added.
8. Deploy Firestore rules separately from Firebase CLI or Firebase Console.

## Suggested Firestore Model

At minimum:

- `tests`: admin read/write only, public read only for active tests by slug.
- `testResults`: public create only for submissions, owning tutor read only, no public list access.
- `reports`: owning tutor read/write only, generated from a submitted result, with separate PDF download metadata if PDFs are stored.
- `learningPlans`: owning tutor read/write only, generated separately from the report, with separate PDF download metadata if PDFs are stored.
- `users`: authenticated tutor profile and role metadata.

Avoid storing API keys, secrets, or private tutor settings in Firestore documents readable by public clients.
