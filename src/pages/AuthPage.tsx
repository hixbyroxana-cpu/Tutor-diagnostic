import { type FormEvent, useState } from 'react';
import type { UserCredential } from 'firebase/auth';
import { Chrome, LoaderCircle, LockKeyhole, LogIn, Mail, UserPlus } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { friendlyAuthError } from '../auth/auth-errors';
import { acceptsBootstrapStatus } from '../auth/bootstrap-response';
import {
  passwordResetActionCodeSettings,
  requestPasswordReset,
} from '../auth/password-reset';
import {
  auth,
  createUserWithEmailAndPassword,
  googleProvider,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from '../firebase';
import { cn } from '../lib/utils';

type AuthMode = 'sign-in' | 'register';

type AuthLocationState = {
  returnTo?: string;
};

function errorCode(error: unknown) {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }

  return undefined;
}

async function bootstrapAccount(credential: UserCredential) {
  const idToken = await credential.user.getIdToken();
  const response = await fetch('/api/account/bootstrap', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  if (!acceptsBootstrapStatus(response.status)) {
    throw new Error('We could not finish setting up your account. Please try again.');
  }
}

export default function AuthPage() {
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const [resetting, setResetting] = useState(false);
  const busy = submitting || resetting;
  const location = useLocation();
  const navigate = useNavigate();
  const locationState = location.state as AuthLocationState | null;
  const requestedReturnTo = locationState?.returnTo;
  const returnTo = requestedReturnTo?.startsWith('/') && !requestedReturnTo.startsWith('//')
    ? requestedReturnTo
    : '/dashboard';

  async function finishAuthentication(credential: UserCredential) {
    try {
      await bootstrapAccount(credential);
    } catch (bootstrapError) {
      try {
        await signOut(auth);
      } catch {
        // Preserve the bootstrap error even when Firebase sign-out also fails.
      }

      throw bootstrapError;
    }

    navigate(returnTo, { replace: true });
  }

  async function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setResetMessage('');
    setSubmitting(true);

    try {
      const credential = mode === 'sign-in'
        ? await signInWithEmailAndPassword(auth, email.trim(), password)
        : await createUserWithEmailAndPassword(auth, email.trim(), password);
      await finishAuthentication(credential);
    } catch (nextError) {
      setError(nextError instanceof Error && !errorCode(nextError)
        ? nextError.message
        : friendlyAuthError(errorCode(nextError)));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitGoogle() {
    setError('');
    setResetMessage('');
    setSubmitting(true);

    try {
      const credential = await signInWithPopup(auth, googleProvider);
      await finishAuthentication(credential);
    } catch (nextError) {
      setError(nextError instanceof Error && !errorCode(nextError)
        ? nextError.message
        : friendlyAuthError(errorCode(nextError)));
    } finally {
      setSubmitting(false);
    }
  }

  async function requestReset() {
    setError('');
    setResetMessage('');
    setResetting(true);

    try {
      const message = await requestPasswordReset(
        email,
        (normalizedEmail) => sendPasswordResetEmail(
          auth,
          normalizedEmail,
          passwordResetActionCodeSettings(window.location.origin),
        ),
      );
      setResetMessage(message);
    } catch (nextError) {
      setError(nextError instanceof Error
        ? nextError.message
        : 'We could not send the reset email. Please try again.');
    } finally {
      setResetting(false);
    }
  }

  return (
    <main className="brand-shell min-h-screen flex items-center justify-center p-4 sm:p-8">
      <section className="brand-panel w-full max-w-md rounded-lg p-6 sm:p-8" aria-labelledby="account-heading">
        <div className="flex items-center gap-3 mb-7">
          <div className="w-10 h-10 bg-[#126b73] rounded-lg flex items-center justify-center text-white font-bold shadow-sm">
            Σ
          </div>
          <div>
            <h1 id="account-heading" className="text-xl font-bold text-[#172033]">Tutor account</h1>
            <p className="text-sm text-slate-600">Sign in to manage tests and results.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 rounded-lg bg-slate-100 p-1 mb-6" role="group" aria-label="Account mode">
          {([
            { value: 'sign-in' as const, label: 'Sign in' },
            { value: 'register' as const, label: 'Register' },
          ]).map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={mode === option.value}
              className={cn(
                'min-h-10 rounded-md px-3 text-sm font-semibold transition-colors',
                mode === option.value
                  ? 'bg-white text-[#126b73] shadow-sm'
                  : 'text-slate-600 hover:text-slate-900',
              )}
              onClick={() => {
                setMode(option.value);
                setError('');
                setResetMessage('');
              }}
              disabled={busy}
            >
              {option.label}
            </button>
          ))}
        </div>

        <form className="space-y-4" onSubmit={submitEmail}>
          <label className="block">
            <span className="block text-sm font-semibold text-slate-700 mb-1.5">Email address</span>
            <span className="relative block">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
              <input
                type="email"
                autoComplete="email"
                required
                disabled={busy}
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setResetMessage('');
                }}
                className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-slate-900 outline-none transition focus:border-[#126b73] focus:ring-2 focus:ring-teal-700/15 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
              />
            </span>
          </label>

          <label className="block">
            <span className="block text-sm font-semibold text-slate-700 mb-1.5">Password</span>
            <span className="relative block">
              <LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
              <input
                type="password"
                autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
                required
                minLength={6}
                disabled={busy}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-slate-900 outline-none transition focus:border-[#126b73] focus:ring-2 focus:ring-teal-700/15 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
              />
            </span>
          </label>

          {mode === 'sign-in' && (
            <div className="-mt-2 flex justify-end">
              <button
                type="button"
                onClick={requestReset}
                disabled={busy}
                aria-busy={resetting}
                className="inline-flex min-h-8 items-center gap-1.5 text-sm font-semibold text-[#126b73] hover:text-[#0d545b] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {resetting && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {resetting ? 'Sending reset email...' : 'Forgot password?'}
              </button>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700" role="alert">
              {error}
            </div>
          )}

          {resetMessage && (
            <div className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2.5 text-sm text-teal-800" role="status">
              {resetMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="brand-button w-full min-h-11 rounded-lg px-4 flex items-center justify-center gap-2 font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? (
              <LoaderCircle className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : mode === 'sign-in' ? (
              <LogIn className="w-4 h-4" aria-hidden="true" />
            ) : (
              <UserPlus className="w-4 h-4" aria-hidden="true" />
            )}
            {mode === 'sign-in' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <div className="flex items-center gap-3 my-5" aria-hidden="true">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-xs font-medium uppercase text-slate-400">or</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <button
          type="button"
          onClick={submitGoogle}
          disabled={busy}
          className="w-full min-h-11 rounded-lg border border-slate-300 bg-white px-4 flex items-center justify-center gap-2 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Chrome className="w-4 h-4" aria-hidden="true" />
          Continue with Google
        </button>
      </section>
    </main>
  );
}
