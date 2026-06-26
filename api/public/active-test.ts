import type { Firestore, QueryDocumentSnapshot } from 'firebase-admin/firestore';
import type { Test } from '../../src/types.js';
import { HttpError } from '../_http.js';

type TestDocLike = Pick<QueryDocumentSnapshot, 'id' | 'data'>;

export function selectSingleActiveTestDoc<TDoc extends TestDocLike>(docs: TDoc[]) {
  if (docs.length === 0) {
    throw new HttpError(404, 'Test not found or no longer active.');
  }

  if (docs.length > 1) {
    throw new HttpError(409, 'This test link is temporarily unavailable.');
  }

  return docs[0];
}

export async function loadSingleActiveTestBySlug(db: Firestore, slug: string): Promise<Test> {
  const snapshot = await db
    .collection('tests')
    .where('slug', '==', slug)
    .where('isActive', '==', true)
    .limit(2)
    .get();

  const doc = selectSingleActiveTestDoc(snapshot.docs);
  return { ...doc.data(), id: doc.id } as Test;
}
