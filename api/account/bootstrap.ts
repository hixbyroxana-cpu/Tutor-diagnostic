import { getAdminDb } from '../_firebase-admin.js';
import { handleApiError, requirePost, sendJson } from '../_http.js';
import { requireTutor } from '../_auth.js';
import {
  buildStarterTest,
  buildTutorProfile,
  selectRequiredStarterTemplates,
  type StarterTestTemplate,
} from './_bootstrap-core.js';

export default async function handler(req: any, res: any) {
  if (!requirePost(req, res)) return;

  try {
    const tutor = await requireTutor(req);
    const db = getAdminDb();
    const now = Date.now();

    const templateSnapshot = await db.collection('testTemplates').get();
    const templates = templateSnapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
    })) as StarterTestTemplate[];
    const requiredTemplates = selectRequiredStarterTemplates(templates);

    const result = await db.runTransaction(async transaction => {
      const profileRef = db.collection('tutors').doc(tutor.uid);
      const testRefs = requiredTemplates.map(template => ({
        template,
        ref: db.collection('tests').doc(`${tutor.uid}_${template.id}`),
      }));

      const profileSnap = await transaction.get(profileRef);
      const testSnaps = await Promise.all(testRefs.map(({ ref }) => transaction.get(ref)));
      const existingProfile = profileSnap.exists ? profileSnap.data() : undefined;
      const profile = buildTutorProfile(tutor, existingProfile, now);
      const createdStarterTestIds: string[] = [];

      transaction.set(profileRef, profile, { merge: true });

      testRefs.forEach(({ template, ref }, index) => {
        if (testSnaps[index].exists) return;

        transaction.set(ref, buildStarterTest(template, tutor.uid, now));
        createdStarterTestIds.push(ref.id);
      });

      return {
        profile,
        createdStarterTestCount: createdStarterTestIds.length,
        createdStarterTestIds,
      };
    });

    sendJson(res, 200, result);
  } catch (error) {
    handleApiError(res, error, 'Failed to bootstrap tutor account.');
  }
}
