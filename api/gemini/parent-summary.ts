import { generateParentSummaryOnServer, requirePost, sendJson } from '../_gemini.js';

export default async function handler(req: any, res: any) {
  if (!requirePost(req, res)) return;

  try {
    if (!req.body?.result) {
      sendJson(res, 400, { error: 'Missing result.' });
      return;
    }

    const summary = await generateParentSummaryOnServer(req.body.result);
    sendJson(res, 200, { summary });
  } catch (error) {
    console.error('Gemini parent-summary error:', error);
    sendJson(res, 500, { error: 'Failed to generate parent summary. Please try again.' });
  }
}
