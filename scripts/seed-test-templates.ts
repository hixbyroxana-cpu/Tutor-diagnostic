import { getAdminDb } from '../api/_firebase-admin.js';

const TEMPLATE_SOURCES = [
  { sourceId: 'Np8zdC1SdYtk1ZdlpF3T', templateId: '11-plus-diagnostic' },
  { sourceId: 'W4P9LRmsoy0psFmaJR9U', templateId: 'gcse-foundation-overall-revision' },
] as const;

async function main() {
  const db = getAdminDb();
  const now = Date.now();

  for (const { sourceId, templateId } of TEMPLATE_SOURCES) {
    const sourceSnap = await db.collection('tests').doc(sourceId).get();

    if (!sourceSnap.exists) {
      throw new Error(`Missing source test ${sourceId} for template ${templateId}.`);
    }

    const { ownerId, id, ...sourceData } = sourceSnap.data() ?? {};
    const templatePayload = {
      ...sourceData,
      templateVersion: 1,
      templateSourceTestId: sourceId,
      updatedAt: now,
    };

    await db.collection('testTemplates').doc(templateId).set(templatePayload, { merge: true });
    console.log(`Seeded testTemplates/${templateId} from tests/${sourceId}.`);
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
