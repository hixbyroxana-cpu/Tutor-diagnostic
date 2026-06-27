import { getAdminDb } from '../_firebase-admin.js';
import { notificationsConfigured, sendResultEmail } from '../_email.js';
import { handleApiError, HttpError, requirePost, sendJson } from '../_http.js';
import {
  assertSubmissionId,
  assertStudentInfo,
  buildStoredResult,
  type DuplicateSubmissionResponse,
  duplicateSubmissionResponse,
  normalizeAnswers,
} from './submission-core.js';
import { loadSingleActiveTestBySlug } from './active-test.js';
import { notifyTutorOfResult } from './result-notification.js';

function requestBody(req: any) {
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      throw new HttpError(400, 'Request body must be valid JSON.');
    }
  }

  if (!req.body || typeof req.body !== 'object') {
    throw new HttpError(400, 'Request body is required.');
  }

  return req.body as Record<string, unknown>;
}

function bodyString(body: Record<string, unknown>, key: string) {
  const value = body[key];
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

export function requireSubmissionSlug(body: Record<string, unknown>) {
  const slug = bodyString(body, 'slug');
  if (!slug) {
    throw new HttpError(400, 'slug is required.');
  }

  return slug;
}

export function duplicateResponseForExistingSubmission(
  resultId: string,
  existingResult: Record<string, unknown> | undefined,
  requestedSlug: string,
): DuplicateSubmissionResponse {
  if (existingResult?.testSlug !== requestedSlug) {
    throw new HttpError(409, 'submissionId already belongs to a different test.');
  }

  return duplicateSubmissionResponse(resultId);
}

function isAlreadyExistsError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const code = (error as { code?: unknown }).code;
  return code === 6 || code === 'already-exists';
}

export default async function handler(req: any, res: any) {
  if (!requirePost(req, res)) return;

  try {
    const body = requestBody(req);
    const submissionId = assertSubmissionId(body.submissionId);
    const slug = requireSubmissionSlug(body);
    const db = getAdminDb();
    const resultRef = db.collection('testResults').doc(submissionId);
    const existing = await resultRef.get();

    if (existing.exists) {
      sendJson(res, 200, duplicateResponseForExistingSubmission(existing.id, existing.data(), slug));
      return;
    }

    const studentInfo = assertStudentInfo(body.studentInfo);
    const answers = normalizeAnswers(body.answers);
    const test = await loadSingleActiveTestBySlug(db, slug);
    const result = buildStoredResult(test, answers, studentInfo, submissionId, Date.now());

    try {
      await resultRef.create(result);
    } catch (error) {
      if (isAlreadyExistsError(error)) {
        const reread = await resultRef.get();
        sendJson(res, 200, duplicateResponseForExistingSubmission(resultRef.id, reread.data(), slug));
        return;
      }

      throw error;
    }

    await notifyTutorOfResult(
      {
        enabled: notificationsConfigured(),
        resultId: resultRef.id,
        result,
      },
      {
        async loadTutor(ownerId) {
          const tutorSnapshot = await db.collection('tutors').doc(ownerId).get();
          const tutor = tutorSnapshot.data();
          if (!tutorSnapshot.exists || typeof tutor?.email !== 'string') return null;

          return {
            email: tutor.email,
            displayName: typeof tutor.displayName === 'string'
              ? tutor.displayName
              : tutor.email,
          };
        },
        send: sendResultEmail,
        update: fields => resultRef.update(fields),
        now: Date.now,
        log: (message, error) => console.error(message, error),
      },
    );

    sendJson(res, 200, { resultId: resultRef.id });
  } catch (error) {
    handleApiError(res, error, 'Failed to submit test result.');
  }
}
