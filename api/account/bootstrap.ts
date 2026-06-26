import { getAdminDb } from '../_firebase-admin.js';
import { handleApiError, requirePost, sendJson } from '../_http.js';
import { requireTutor } from '../_auth.js';
import { buildStarterTest, type StarterTestTemplate } from './bootstrap-core.js';

function profileSummaryFromToken(tutor: Awaited<ReturnType<typeof requireTutor>>, existingCreatedAt: unknown, now: number) {
  return {
    uid: tutor.uid,
    email: tutor.email ?? '',
    displayName: tutor.name ?? '',
    createdAt: typeof existingCreatedAt === 'number' ? existingCreatedAt : now,
    templatesProvisionedAt: now,
  };
}

export default async function handler(req: any, res: any) {
  if (!requirePost(req, res)) return;

  try {
    const tutor = await requireTutor(req);
    const db = getAdminDb();
    const now = Date.now();

    const templateSnapshot = await db.collection('testTemplates').get();
    const templates = templateSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as StarterTestTemplate[];

    const result = await db.runTransaction(async transaction => {
      const profileRef = db.collection('tutors').doc(tutor.uid);
      const testRefs = templates.map(template => ({
        template,
        ref: db.collection('tests').doc(`${tutor.uid}_${template.id}`),
      }));

      const profileSnap = await transaction.get(profileRef);
      const testSnaps = await Promise.all(testRefs.map(({ ref }) => transaction.get(ref)));
      const existingProfile = profileSnap.exists ? profileSnap.data() : undefined;
      const profile = profileSummaryFromToken(tutor, existingProfile?.createdAt, now);
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
