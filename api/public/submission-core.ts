import type { Test, TestResult } from '../../src/types.js';
import { calculateTestResults, type StudentResultInfo } from '../../src/lib/marking.js';
import { HttpError } from '../_http.js';

const UUID_LIKE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_STUDENT_NAME_LENGTH = 80;
const LEGACY_OWNERLESS_RESULT_OWNER_ID = '';

export interface PublicStudentInfo extends StudentResultInfo {
  studentFirstName: string;
  studentLastName: string;
}

export interface DuplicateSubmissionResponse {
  resultId: string;
  duplicate: true;
}

function boundedString(value: unknown, fieldLabel: string, maxLength: number) {
  if (typeof value !== 'string') {
    throw new HttpError(400, `${fieldLabel} is required.`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new HttpError(400, `${fieldLabel} is required.`);
  }

  if (trimmed.length > maxLength) {
    throw new HttpError(400, `${fieldLabel} must be ${maxLength} characters or fewer.`);
  }

  return trimmed;
}

function optionalString(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

export function assertSubmissionId(submissionId: unknown) {
  if (typeof submissionId !== 'string' || !UUID_LIKE_PATTERN.test(submissionId)) {
    throw new HttpError(400, 'submissionId must be a UUID-like token.');
  }

  return submissionId;
}

export function assertStudentInfo(studentInfo: unknown): PublicStudentInfo {
  const info = studentInfo && typeof studentInfo === 'object'
    ? studentInfo as Record<string, unknown>
    : {};

  return {
    studentFirstName: boundedString(info.studentFirstName, 'Student first name', MAX_STUDENT_NAME_LENGTH),
    studentLastName: boundedString(info.studentLastName, 'Student last name', MAX_STUDENT_NAME_LENGTH),
    parentName: optionalString(info.parentName, 120),
    parentEmail: optionalString(info.parentEmail, 254),
    notes: optionalString(info.notes, 1_000),
  };
}

export function assertAnswerQuestionIds(test: Test, answers: Record<string, unknown>) {
  const storedQuestionIds = new Set(test.questions.map((question) => question.id));
  const unknownQuestionIds = Object.keys(answers).filter((questionId) => !storedQuestionIds.has(questionId));

  if (unknownQuestionIds.length > 0) {
    throw new HttpError(400, `Answers include unknown question ids: ${unknownQuestionIds.join(', ')}`);
  }
}

export function normalizeAnswers(answers: unknown) {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    throw new HttpError(400, 'answers must be an object keyed by question id.');
  }

  return Object.fromEntries(
    Object.entries(answers as Record<string, unknown>)
      .map(([questionId, answer]) => [questionId, typeof answer === 'string' ? answer : String(answer ?? '')]),
  );
}

export function buildStoredResult(
  test: Test,
  answers: Record<string, string>,
  studentInfo: PublicStudentInfo,
  submissionId: string,
  completedAt: number,
): TestResult {
  const normalizedStudentInfo = assertStudentInfo(studentInfo);
  assertSubmissionId(submissionId);
  assertAnswerQuestionIds(test, answers);

  return {
    ...calculateTestResults(test, answers, normalizedStudentInfo),
    // Legacy public tests may be ownerless until migration; keep writes Firestore-safe.
    ownerId: test.ownerId ?? LEGACY_OWNERLESS_RESULT_OWNER_ID,
    isNew: true,
    completedAt,
    submissionId,
    notificationStatus: 'pending',
  };
}

export function duplicateSubmissionResponse(resultId: string): DuplicateSubmissionResponse {
  return {
    resultId,
    duplicate: true,
  };
}
