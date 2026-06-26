import { getAdminDb } from '../_firebase-admin.js';
import { handleApiError, HttpError, requireMethod, sendJson } from '../_http.js';
import type { Question, Test } from '../../src/types.js';

function publicQuestion(question: Question) {
  const { correctAnswer, explanation, target, ...safeQuestion } = question;
  void correctAnswer;
  void explanation;
  void target;
  return safeQuestion;
}

export function buildPublicTestPayload(test: Test) {
  return {
    title: test.title,
    level: test.level,
    slug: test.slug,
    description: test.description,
    questions: test.questions.map(publicQuestion),
  };
}

function slugFromQuery(query: Record<string, unknown>) {
  const slug = query.slug;
  if (typeof slug !== 'string' || !slug.trim()) {
    throw new HttpError(400, 'A valid slug is required.');
  }

  return slug.trim();
}

export default async function handler(req: any, res: any) {
  if (!requireMethod(req, res, 'GET')) return;

  try {
    const slug = slugFromQuery(req.query ?? {});
    const db = getAdminDb();
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
    sendJson(res, 200, buildPublicTestPayload({ ...doc.data(), id: doc.id } as Test));
  } catch (error) {
    handleApiError(res, error, 'Failed to load public test.');
  }
}
