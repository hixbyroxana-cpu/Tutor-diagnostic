import { generateSpecificQuestionsOnServer, requirePost, sendJson } from '../_gemini.js';

export default async function handler(req: any, res: any) {
  if (!requirePost(req, res)) return;

  try {
    const { level, description, count = 3 } = req.body || {};

    if (!level || !description) {
      sendJson(res, 400, { error: 'Missing level or description.' });
      return;
    }

    const safeCount = Math.max(1, Math.min(5, Number(count) || 3));
    const questions = await generateSpecificQuestionsOnServer(level, String(description), safeCount);
    sendJson(res, 200, { questions });
  } catch (error) {
    console.error('Gemini generate-specific error:', error);
    sendJson(res, 500, { error: 'Failed to generate test questions. Please try again.' });
  }
}
