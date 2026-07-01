# Diagnostic Click Password Reset Design

## Goal

Allow tutors who cannot sign in with an email and password to request a secure Firebase password-reset email from the existing account page.

## User Experience

- Show a `Forgot password?` button only in Sign in mode, beneath the password field.
- Use the email address already entered in the form.
- If the email field is empty or invalid, ask the tutor to enter a valid email address before requesting a reset.
- While the request is running, disable account controls and show progress on the reset button.
- After Firebase accepts the request, show: `If an account exists for that email, check your inbox for a password reset link.`
- Keep the confirmation neutral so the page does not reveal whether an email address is registered.
- Keep registration and Google sign-in behavior unchanged.

## Architecture

- Export Firebase's client-side `sendPasswordResetEmail` function from `src/firebase.ts`.
- Put the request behavior in a small auth helper with an injected sender so validation, normalization, and safe error behavior can be tested without rendering React.
- Have `AuthPage` call the helper and display its success or error message.
- Use Firebase's hosted reset handler. The tutor follows the emailed link, chooses a new password, then returns to `https://diagnostic.click/account` to sign in.

## Error Handling

- Empty or invalid email: show a local validation message and do not contact Firebase.
- Accepted reset request, including Firebase's protected account-enumeration response: show the neutral inbox confirmation.
- Network or service failure: show a retry message without exposing Firebase internals.
- Switching between Sign in and Register clears reset feedback.

## Testing

- Test that email addresses are trimmed before sending.
- Test that missing or invalid email addresses are rejected without calling Firebase.
- Test that successful requests return the neutral confirmation.
- Test that Firebase failures return a safe retry message.
- Run the complete unit suite, type-check, production build, and Vercel build.
- In production, verify that `Forgot password?` is present only in Sign in mode and that a reset request shows the neutral confirmation.

## Out of Scope

- Custom reset-email templates.
- A custom password-reset backend.
- Administrator-generated reset links.
- Changing or recovering passwords for accounts managed only through Google sign-in.
