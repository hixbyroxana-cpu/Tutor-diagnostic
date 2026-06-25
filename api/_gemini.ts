import { GoogleGenAI } from '@google/genai';
import type { LegacyTestResult, Question, TestLevel } from '../src/types';

let ai: GoogleGenAI | null = null;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const FALLBACK_MODELS = Array.from(new Set([
  GEMINI_MODEL,
  'gemini-2.0-flash',
  'gemini-1.5-flash',
]));

function getAi() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('Gemini API key is missing. Add GEMINI_API_KEY to Vercel environment variables.');
  }

  ai ??= new GoogleGenAI({ apiKey });
  return ai;
}

async function generateContentWithFallback(request: any) {
  let lastError: any;

  for (const model of FALLBACK_MODELS) {
    try {
      return await getAi().models.generateContent({
        ...request,
        model,
      });
    } catch (error: any) {
      lastError = error;
      const status = error?.status || error?.error?.code;
      if (status !== 429 && status !== 503) {
        throw error;
      }
    }
  }

  throw lastError;
}

function normalizeGeneratedQuestions(questions: Omit<Question, 'id'>[]) {
  return questions.map((q, index) => {
    if (!Array.isArray(q.choices) || q.choices.length !== 4) {
      throw new Error('AI returned a question without exactly 4 answer choices.');
    }

    if (!q.choices.includes(q.correctAnswer)) {
      throw new Error('AI returned a correct answer that does not exactly match one of the 4 choices.');
    }

    const correctChoice = q.correctAnswer;
    const distractors = q.choices.filter(choice => choice !== correctChoice);
    const targetCorrectIndex = index % 4;
    const balancedChoices = [
      ...distractors.slice(0, targetCorrectIndex),
      correctChoice,
      ...distractors.slice(targetCorrectIndex),
    ];

    return {
      ...q,
      choices: balancedChoices,
      id: Date.now().toString(36) + Math.random().toString(36).substring(2),
    };
  });
}

function levelSpecificGenerationRules(level: TestLevel) {
  if (level === 'GCSE Foundation') {
    return `GCSE Foundation difficulty ramp:
- Questions 1-8: accessible foundation recall and one-step skills.
- Questions 9-14: mixed foundation skills with short reasoning or interpretation.
- Questions 15-20: include at least 4 two-step or three-step Foundation-tier problem-solving questions. These should still be Foundation content, but should feel like later-paper GCSE questions with context, interpretation, or combining skills.
- Do NOT make every question a first-part fluency question. The final third must be more challenging while staying Foundation tier.
- For perimeter/area of compound or L-shaped shapes, include a visible diagram using visualType "l_shape" and dimensions in visualData.lShape.
- For coordinates, plotting points, reading points, or four-quadrant graphs, use visualType "coordinate_grid". Keep coordinates between -10 and 10 so the numbered axes are readable.`;
  }

  if (level === 'GCSE Higher') {
    return `GCSE Higher difficulty ramp:
- Include multi-step reasoning across the test, with the final third containing the most demanding questions.
- Use visual diagrams where the question depends on a graph, coordinate grid, chart, or geometric shape.`;
  }

  return `Difficulty ramp:
- Begin with accessible diagnostic questions, then increase challenge gradually.
- Put the more demanding multi-step questions toward the end of the test where appropriate for ${level}.`;
}

function questionJsonContract(count: number | '20') {
  return `Provide the response as a JSON array of objects, with NO surrounding markdown formatting or backticks.
Exactly ${count} elements.

Each object must follow this exact structure:
{
  "question": "question text",
  "choices": ["choice 1", "choice 2", "choice 3", "choice 4"],
  "correctAnswer": "exact string matching one of the choices",
  "topic": "broad topic (e.g., Fractions, Algebra, Geometry)",
  "skill": "specific skill",
  "difficulty": "easy" or "medium" or "hard",
  "explanation": "brief step-by-step reasoning",
  "target": "A suggested target if they get it wrong",
  "visualType": "none" or "bar_chart" or "pie_chart" or "coordinate_grid" or "l_shape",
  "visualData": {
    "data": [{ "name": "Category A", "value": 10 }],
    "point": { "x": 3, "y": -2 },
    "points": [{ "x": -4, "y": 3 }, { "x": 5, "y": -2 }],
    "lShape": { "totalWidth": 12, "totalHeight": 9, "cutoutWidth": 5, "cutoutHeight": 4, "unit": "cm" },
    "xAxisLabel": "",
    "yAxisLabel": ""
  }
}`;
}

export async function generateDiagnosticTestOnServer(level: TestLevel, aiPrompt: string): Promise<Question[]> {
  const prompt = `You are an expert mathematics tutor in the UK educational system.
Generate a 20-question multiple-choice diagnostic test for ${level} Maths.

${aiPrompt ? `Context/Instructions for the AI (strictly follow this): ${aiPrompt}` : ''}

ENSURE the difficulty correlates PRECISELY to the UK curriculum level specified (${level}). The questions must NOT be too difficult for this level. DO NOT OVERCOMPLICATE.
${levelSpecificGenerationRules(level)}

All questions MUST be multiple choice, even when inspired by write-in exam-paper questions.
Every question MUST have exactly 4 answer choices: 1 correct answer and 3 plausible distractors based on common mistakes.
Spread the correct answers across all four answer positions. Do not put most correct answers in the first or second option.
Do not generate open-response questions, "show your working" questions, missing answer boxes, or questions without answer choices.
If using past-paper style as inspiration, DO NOT copy any real exam question, wording, numbers, answer options, diagram, table, chart, names, or scenario.
Generate original questions with different digits, changed contexts, and fresh answer choices while keeping only the general skill and style.

${questionJsonContract('20')}

Ensure the questions cover a wide range of topics suitable for ${level}. Ensure variety to avoid repeating very similar questions.
At least 4 questions MUST include visual elements (bar charts, pie charts, coordinate grids, or L-shape diagrams).
If a question asks about perimeter or area of an L-shape/compound rectilinear shape, the visualType MUST be "l_shape".
If a question asks about reading, plotting, translating, or reflecting coordinates in four quadrants, the visualType MUST be "coordinate_grid".
Choices should include common misconceptions as distractors.
Across the full 20-question test, the correct answer positions should be balanced across choices 1-4.
Exactly 4 string choices per question. Never output fewer or more than 4 choices.`;

  const response = await generateContentWithFallback({
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      temperature: 0.8,
    },
  });

  if (!response.text) throw new Error('No response from Gemini');

  return normalizeGeneratedQuestions(JSON.parse(response.text));
}

export async function generateSpecificQuestionsOnServer(
  level: TestLevel,
  description: string,
  count = 3,
): Promise<Question[]> {
  const prompt = `You are an expert mathematics tutor in the UK educational system.
Generate ${count} multiple-choice question(s) for ${level} Maths based on this description/topic: "${description}".

ENSURE the difficulty correlates PRECISELY to the UK curriculum level specified (${level}). The questions must NOT be too difficult for this level. DO NOT OVERCOMPLICATE.
${levelSpecificGenerationRules(level)}

All questions MUST be multiple choice, even when inspired by write-in exam-paper questions.
Every question MUST have exactly 4 answer choices: 1 correct answer and 3 plausible distractors based on common mistakes.
Spread the correct answers across all four answer positions where possible.
Do not generate open-response questions, "show your working" questions, missing answer boxes, or questions without answer choices.
If using past-paper style as inspiration, DO NOT copy any real exam question, wording, numbers, answer options, diagram, table, chart, names, or scenario.
Generate original questions with different digits, changed contexts, and fresh answer choices while keeping only the general skill and style.

${questionJsonContract(count)}

If the user request mentions charts, graphs, grids, plotting, pie charts, bar charts, compound shapes, L-shapes, perimeter, or area diagrams, you MUST output the correct visualType and visualData.
If the question depends on an L-shape, use visualType "l_shape"; do not merely describe the L-shape in words.
If the question depends on coordinates in four quadrants, use visualType "coordinate_grid" and keep x/y values between -10 and 10.
Choices should include common misconceptions as distractors.
Exactly 4 string choices per question. Never output fewer or more than 4 choices.`;

  const response = await generateContentWithFallback({
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      temperature: 0.8,
    },
  });

  if (!response.text) throw new Error('No response from Gemini');

  return normalizeGeneratedQuestions(JSON.parse(response.text));
}

export async function generateParentSummaryOnServer(result: LegacyTestResult): Promise<string> {
  const breakdownStr = result.topicBreakdown
    .map(t => `- ${t.topic}: ${t.percentage}% (${t.status})`)
    .join('\n');

  const targetsStr = result.suggestedTargets.length > 0
    ? result.suggestedTargets.map(t => `- ${t}`).join('\n')
    : 'None, excellent performance across the board.';

  const prompt = `You are a professional, encouraging maths tutor.
Write a structured diagnostic report for the parent of a student named ${result.studentFirstName} who just completed a ${result.testLevel} Maths diagnostic test.
They scored ${result.score}/${result.totalQuestions} (${result.percentage}%).

Here is the breakdown by topic:
${breakdownStr}

Here is a list of suggested targets for improvement:
${targetsStr}

Use this exact structure and headings:

Overview
Write 2 short sentences that explain the purpose of the diagnostic and keep the tone encouraging.

Score Snapshot
Write 2 short sentences with the score, percentage, and a plain-English interpretation.

Strengths
Write 1 short lead-in sentence, then use up to 3 bullet points. Mention secure topics or positive behaviours. If there are no secure topics, identify effort, completion, or any developing areas without pretending there are secure skills.

Areas To Strengthen
Write 1 short lead-in sentence, then use up to 3 bullet points. Explain the most important weak or developing topics in parent-friendly language.

Suggested Targets
Write 1 short lead-in sentence, then use up to 3 bullet points. Turn the target list into clear action points.

Next Steps
Write 1 short lead-in sentence, then use 2 bullet points describing what tutoring should focus on next.

Rules:
- Use clear headings exactly as written above.
- Keep paragraphs short.
- Avoid long dense blocks of text.
- Keep the whole report between 350 and 450 words.
- Keep the tone professional, reassuring, and honest.
- Do not include a generic greeting like "Dear [Parent]".
- Do not invent achievements that are not supported by the results.`;

  const response = await generateContentWithFallback({
    contents: prompt,
  });

  return response.text?.trim() || '';
}

export function sendJson(res: any, status: number, body: unknown) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(body));
}

export function requirePost(req: any, res: any) {
  if (req.method === 'POST') return true;

  sendJson(res, 405, { error: 'Method not allowed' });
  return false;
}
