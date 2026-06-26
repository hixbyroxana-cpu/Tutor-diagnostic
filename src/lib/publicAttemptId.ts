const PUBLIC_ATTEMPT_STORAGE_PREFIX = 'public-test-submission-id:';

interface AttemptIdOptions {
  storage?: Pick<Storage, 'setItem'>;
  createId?: () => string;
}

function attemptStorageKey(slug: string) {
  return `${PUBLIC_ATTEMPT_STORAGE_PREFIX}${slug}`;
}

export function createSubmissionId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c =>
    (Number(c) ^ ((Math.random() * 16) >> (Number(c) / 4))).toString(16)
  );
}

export function startPublicAttemptId(slug: string, options: AttemptIdOptions = {}) {
  const next = (options.createId ?? createSubmissionId)();

  try {
    (options.storage ?? sessionStorage).setItem(attemptStorageKey(slug), next);
  } catch {
    // Storage may be unavailable; the in-memory id still keeps active-attempt retries stable.
  }

  return next;
}

export function clearPublicAttemptId(
  slug: string,
  storage: Pick<Storage, 'removeItem'> = sessionStorage,
) {
  try {
    storage.removeItem(attemptStorageKey(slug));
  } catch {
    // Storage may be unavailable; clearing local component state is still enough.
  }
}
