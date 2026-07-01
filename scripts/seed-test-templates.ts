import { pathToFileURL } from 'node:url';
import { getAdminDb } from '../api/_firebase-admin.js';

const TEMPLATE_SOURCES = [
  { sourceId: 'Np8zdC1SdYtk1ZdlpF3T', templateId: '11-plus-diagnostic' },
  { sourceId: 'W4P9LRmsoy0psFmaJR9U', templateId: 'gcse-foundation-overall-revision' },
] as const;

export function buildTemplatePayload(sourceData: Record<string, unknown>, sourceId: string, now: number) {
  const { ownerId, id, ...sanitizedSourceData } = sourceData;

  return {
    ...sanitizedSourceData,
    templateVersion: 1,
    templateSourceTestId: sourceId,
    updatedAt: now,
  };
}

export async function main() {
  const db = getAdminDb();
  const now = Date.now();

  for (const { sourceId, templateId } of TEMPLATE_SOURCES) {
    const sourceSnap = await db.collection('tests').doc(sourceId).get();

    if (!sourceSnap.exists) {
      throw new Error(`Missing source test ${sourceId} for template ${templateId}.`);
    }

    const templatePayload = buildTemplatePayload(sourceSnap.data() ?? {}, sourceId, now);

    await db.collection('testTemplates').doc(templateId).set(templatePayload);
    console.log(`Seeded testTemplates/${templateId} from tests/${sourceId}.`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(error);
    process.exit(1);
  });
}
