import { generateDiagnosticTestOnServer, requirePost, sendJson } from '../_gemini.js';

export default async function handler(req: any, res: any) {
  if (!requirePost(req, res)) return;

  try {
    const { level, aiPrompt = '' } = req.body || {};

    if (!level) {
      sendJson(res, 400, { error: 'Missing level.' });
      return;
    }

    const questions = await generateDiagnosticTestOnServer(level, String(aiPrompt));
    sendJson(res, 200, { questions });
  } catch (error) {
    console.error('Gemini generate-test error:', error);
    sendJson(res, 500, { error: 'Failed to generate test questions. Please try again.' });
  }
}
