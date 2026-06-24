import { TestLevel, Question, TestResult } from '../types';

async function postJson<T>(url: string, payload: unknown, fallbackMessage: string): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  let data: any = null;

  try {
    data = await response.json();
  } catch {
    // Keep the user-facing error stable even if the API returns a non-JSON error page.
  }

  if (!response.ok) {
    throw new Error(data?.error || fallbackMessage);
  }

  return data as T;
}

export const generateDiagnosticTest = async (
  level: TestLevel,
  aiPrompt: string,
): Promise<Question[]> => {
  const data = await postJson<{ questions: Question[] }>(
    '/api/gemini/generate-test',
    { level, aiPrompt },
    'Failed to generate test questions. Please try again.',
  );

  return data.questions;
};

export const generateSpecificQuestions = async (
  level: TestLevel,
  description: string,
  count = 3,
): Promise<Question[]> => {
  const data = await postJson<{ questions: Question[] }>(
    '/api/gemini/generate-specific',
    { level, description, count },
    'Failed to generate test questions. Please try again.',
  );

  return data.questions;
};

export const generateParentSummary = async (
  result: TestResult,
): Promise<string> => {
  try {
    const data = await postJson<{ summary: string }>(
      '/api/gemini/parent-summary',
      { result },
      'Failed to generate parent summary. Please try again.',
    );

    return data.summary;
  } catch (error) {
    console.error('Gemini Summary Error:', error);
    return 'Hi, thank you for completing the diagnostic test. I have reviewed the result. We will discuss the next steps and areas of focus in our first lesson.';
  }
};
