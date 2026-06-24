# Diagnostic Click Tutor Accounts and Report Notifications

## Goal

Add secure tutor accounts and notify the tutor who owns a test whenever a student completes it. The notification email will include the generated diagnostic report PDF as an attachment and a secure link to the full result in the tutor dashboard.

Stripe subscriptions and trial enforcement are deliberately excluded from this phase. The ownership model introduced here will support billing later without restructuring tests or results.

## Current State

- The admin dashboard has no authentication.
- Anyone who knows the application URL can create or edit tests and view results.
- Firestore currently permits public reads and writes.
- Public test submissions are written directly from the browser to Firestore.
- Diagnostic report PDFs are generated in the browser from saved result data.

These behaviors must be replaced before the application is offered to other tutors.

## Authentication

Diagnostic Click will use Firebase Authentication because the application already uses Firebase.

Supported sign-in methods:

- Email and password
- Google

All dashboard routes require an authenticated tutor. Public student test links remain accessible without an account.

On first sign-in, the application creates a tutor profile containing:

- Firebase user ID
- Account email
- Display name
- Account creation date
- Template provisioning status
- Future subscription fields, initially inactive and unenforced

The account email is the report notification address.

## Ownership and Privacy

Every tutor-owned test contains an `ownerId` matching the tutor's Firebase user ID. Every result inherits the same `ownerId` from its test.

Authenticated tutors may:

- Read, create, update, and delete only their own tests
- Read and update only results belonging to their tests
- Copy their own public test links

Students may:

- Read an active test through its public slug
- Submit a result only for that test

Students may not read saved results. Unauthenticated users may not access dashboard data.

Firestore security rules will enforce these boundaries rather than relying only on hidden UI controls.

## Public Test Submission

The browser will no longer write completed results directly to Firestore.

Instead, the student submission page sends the completed answers to a Vercel server endpoint. The endpoint:

1. Finds the active test by slug.
2. Uses the stored test questions and answers as the marking authority.
3. Calculates the result server-side.
4. Copies the test's `ownerId` onto the result.
5. Saves the result.
6. Generates the diagnostic report PDF.
7. Emails the owning tutor.
8. Returns a successful completion response to the student.

This prevents a student from choosing another tutor as the recipient or modifying their calculated score before storage.

## Starter Tests

Two master templates will be retained:

- 11+ diagnostic test
- GCSE Foundation overall revision test

When a tutor profile is created, the system automatically creates editable copies of both templates for that tutor.

Each copy receives:

- The new tutor's `ownerId`
- A unique public slug
- Its own Firestore document ID
- A reference to the source template version

Tutors may edit or delete their copies. Their changes never affect the master templates or another tutor's tests.

Template provisioning is idempotent. Repeated sign-ins or retried requests must not create duplicate starter tests.

## Existing Data Migration

The account registered as `roxana.scurtu@yahoo.com` becomes the owner of existing non-template tests and all existing reports.

The existing 11+ and GCSE tests become the master template sources. Roxana's account also receives editable personal copies, while historical results remain associated with Roxana.

Migration will run only after Roxana's Firebase account exists, because ownership is stored by Firebase user ID rather than email address.

The migration rollout must preserve current access:

1. Deploy account creation while the existing dashboard remains available.
2. Create and verify the `roxana.scurtu@yahoo.com` owner account.
3. Assign all existing tests and results to that Firebase user ID.
4. Verify Roxana can see the full pre-existing dashboard data.
5. Only then enable the restrictive Firestore rules and authenticated dashboard guard.

No existing test or result is deleted or recreated during migration. Existing document IDs, public slugs, and result links remain unchanged.

## Notification Email

Email provider: Resend.

Brand: Diagnostic Click.

Planned sender:

`Diagnostic Click <reports@mail.diagnostic.click>`

The `mail.diagnostic.click` sending subdomain will be verified in Resend. The application will use environment variables so the sender or domain can change without code changes:

- `APP_BASE_URL=https://diagnostic.click`
- `EMAIL_FROM=Diagnostic Click <reports@mail.diagnostic.click>`
- `RESEND_API_KEY`

The completion email is sent only to the owning tutor's verified account email. It contains:

- Student name
- Test title and level
- Score and percentage
- Completion date
- Attached diagnostic report PDF
- Secure link to the result dashboard

The student or parent receives no automatic report email in this phase.

The attachment will match the existing Diagnostic Click report design: score metrics, strengths, and learning targets. It does not wait for the optional AI parent summary.

Email sending uses an idempotency key based on the result ID so retries do not send duplicate notifications.

If email delivery fails, the completed result remains saved. The endpoint logs the failure and records notification status on the result so the tutor can still find it and a retry can be added later.

## PDF Generation

The current PDF layout logic will be separated into:

- A pure function that returns PDF bytes
- A browser download wrapper
- A server email attachment wrapper

Both dashboard downloads and email attachments will use the same PDF byte generator. This keeps the emailed report visually identical to the report tutors can download from the result page.

## Dashboard Experience

Unauthenticated visitors to dashboard routes are redirected to sign in.

The top navigation shows:

- Tutor name or email
- Sign-out control

Tests, dashboard metrics, and results are filtered by the authenticated tutor's `ownerId`.

The result link in an email opens the relevant result after authentication. If the tutor is signed out, Diagnostic Click sends them to sign in and then returns them to that result.

The attached PDF can be opened directly from the email without signing in.

## Domain Setup

The production application will use `https://diagnostic.click`.

The current `https://tutor-diagnostic.vercel.app` address will remain assigned to the same Vercel project indefinitely for backward compatibility. It will not be removed or redirected during this phase.

Existing public test links on the Vercel domain must continue to open the same tests and save results to the same Firestore database. This includes links sent before authentication is introduced and tests that may already be in progress.

New links and notification emails will use `APP_BASE_URL=https://diagnostic.click`, but both domains will serve the same application and API routes. Public slugs and existing Firestore document IDs will not change.

DNS responsibilities:

- Vercel records for `diagnostic.click`
- Resend SPF and DKIM records for `mail.diagnostic.click`
- Firebase Authentication authorized domain entry for `diagnostic.click`

## Error Handling

- Authentication errors show a clear sign-in or account-creation message.
- Template provisioning retries safely without duplicates.
- Invalid or inactive public test slugs return an unavailable message.
- Result submission cannot succeed twice from repeated client retries without detecting the duplicate.
- PDF or email failures do not discard a valid result.
- Notification state is stored as `pending`, `sent`, or `failed`, with a timestamp and safe error summary.

## Verification

Implementation verification must cover:

1. Email/password registration and sign-in.
2. Google sign-in.
3. Automatic creation of exactly two editable starter tests.
4. Isolation between two tutor accounts.
5. Public access to an active student test.
6. Server-side result calculation and ownership.
7. Result visibility only to the owning tutor.
8. PDF attachment equality with the dashboard report format.
9. Completion email addressed to the owning tutor.
10. No duplicate email on a retried submission.
11. Existing data assigned to Roxana after migration.
12. Roxana can see all pre-existing tests and reports before access restrictions are enabled.
13. Previously issued `tutor-diagnostic.vercel.app/test/...` links still load and submit successfully.
14. Both application domains point to the same production deployment and database.
15. Production domain, Firebase authorized domains, and Resend DNS configuration.

## Later Billing Phase

Stripe will be added after pricing and trial length are decided. Tutor profiles will then gain subscription status, trial dates, Stripe customer ID, and entitlement checks. Tests and results will already be correctly partitioned by tutor, so billing can control access without migrating the core data model again.
