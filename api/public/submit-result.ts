import { getAdminDb } from '../_firebase-admin.js';
import { handleApiError, HttpError, requirePost, sendJson } from '../_http.js';
import type { Test } from '../../src/types.js';
import type { Firestore } from 'firebase-admin/firestore';
import {
  assertSubmissionId,
  assertStudentInfo,
  buildStoredResult,
  duplicateSubmissionResponse,
  normalizeAnswers,
} from './submission-core.js';

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

async function loadActiveTest(db: Firestore, body: Record<string, unknown>) {
  const slug = requireSubmissionSlug(body);
  const snapshot = await db
    .collection('tests')
    .where('slug', '==', slug)
    .where('isActive', '==', true)
    .limit(1)
    .get();

  if (snapshot.empty) {
    throw new HttpError(404, 'Test not found or no longer active.');
  }

  const doc = snapshot.docs[0];
  return { ...doc.data(), id: doc.id } as Test;
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
    const studentInfo = assertStudentInfo(body.studentInfo);
    const answers = normalizeAnswers(body.answers);
    const db = getAdminDb();
    const test = await loadActiveTest(db, body);
    const resultRef = db.collection('testResults').doc(submissionId);
    const existing = await resultRef.get();

    if (existing.exists) {
      sendJson(res, 200, duplicateSubmissionResponse(existing.id));
      return;
    }

    const result = buildStoredResult(test, answers, studentInfo, submissionId, Date.now());

    try {
      await resultRef.create(result);
    } catch (error) {
      if (isAlreadyExistsError(error)) {
        sendJson(res, 200, duplicateSubmissionResponse(resultRef.id));
        return;
      }

      throw error;
    }

    sendJson(res, 200, { resultId: resultRef.id });
  } catch (error) {
    handleApiError(res, error, 'Failed to submit test result.');
  }
}
