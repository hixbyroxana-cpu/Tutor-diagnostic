import { GoogleGenAI } from '@google/genai';
import { TestLevel, Question, TestResult } from '../types';

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const generateDiagnosticTest = async (level: TestLevel, aiPrompt: string): Promise<Question[]> => {
  const prompt = `You are an expert mathematics tutor in the UK educational system.
Generate a 20-question multiple-choice diagnostic test for ${level} Maths.

${aiPrompt ? `Context/Instructions for the AI (strictly follow this): ${aiPrompt}` : ''}

ENSURE the difficulty correlates PRECISELY to the UK curriculum level specified (${level}). The questions must NOT be too difficult for this level. DO NOT OVERCOMPLICATE.

Provide the response as a JSON array of objects, with NO surrounding markdown formatting or backticks.
Exactly 20 elements. 

Each object must follow this exact structure:
{
  "question": "question text",
  "choices": ["choice 1", "choice 2", "choice 3", "choice 4", "choice 5", "choice 6"], 
  "correctAnswer": "exact string matching one of the choices",
  "topic": "broad topic (e.g., Fractions, Algebra, Geometry)",
  "skill": "specific skill (e.g., Simplify fractions, Solve linear equations)",
  "difficulty": "easy" or "medium" or "hard",
  "explanation": "brief step-by-step reasoning",
  "target": "A suggested target if they get it wrong (e.g., 'Practise adding fractions with unlike denominators')",
  "visualType": "none" or "bar_chart" or "pie_chart" or "coordinate_grid",
  "visualData": {
    // If pie_chart or bar_chart:
    "data": [{ "name": "Category A", "value": 10 }, { "name": "Category B", "value": 20 }],
    // If coordinate_grid:
    "point": { "x": 3, "y": -2 },
    // Optional axis labels
    "xAxisLabel": "Optional x-axis label",
    "yAxisLabel": "Optional y-axis label"
  }
}

Ensure the questions cover a wide range of topics suitable for ${level}. Ensure variety to avoid repeating very similar questions.
At least 4 questions MUST include visual elements (bar charts, pie charts, or coordinate grids).
Choices should include common misconceptions as distractors.
6 string choices per question.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.8, // Add variability so tests aren't identical
      }
    });

    if (!response.text) throw new Error("No response from Gemini");

    const parsed: Omit<Question, 'id'>[] = JSON.parse(response.text);
    
    // add unique IDs
    return parsed.map((q) => ({
      ...q,
      id: Date.now().toString(36) + Math.random().toString(36).substring(2)
    }));
  } catch (err) {
    console.error("Gemini Generation Error:", err);
    throw new Error("Failed to generate test questions. Please try again.");
  }
};

export const generateSpecificQuestions = async (level: TestLevel, description: string, count: number = 3): Promise<Question[]> => {
  const prompt = `You are an expert mathematics tutor in the UK educational system.
Generate ${count} multiple-choice question(s) for ${level} Maths based on this description/topic: "${description}".

ENSURE the difficulty correlates PRECISELY to the UK curriculum level specified (${level}). The questions must NOT be too difficult for this level. DO NOT OVERCOMPLICATE.

Provide the response as a JSON array of objects, with NO surrounding markdown formatting or backticks.
Exactly ${count} elements. 

Each object must follow this exact structure:
{
  "question": "question text",
  "choices": ["choice 1", "choice 2", "choice 3", "choice 4", "choice 5", "choice 6"], 
  "correctAnswer": "exact string matching one of the choices",
  "topic": "broad topic (e.g., Fractions, Algebra, Geometry)",
  "skill": "specific skill",
  "difficulty": "easy" or "medium" or "hard",
  "explanation": "brief step-by-step reasoning",
  "target": "A suggested target if they get it wrong",
  "visualType": "none" or "bar_chart" or "pie_chart" or "coordinate_grid",
  "visualData": {
    // If pie_chart or bar_chart:
    "data": [{ "name": "Category A", "value": 10 }],
    // If coordinate_grid:
    "point": { "x": 3, "y": -2 },
    "xAxisLabel": "",
    "yAxisLabel": ""
  }
}

If the user request mentions charts, graphs, grids, plotting, pie charts, or bar charts, you MUST output the correct visualType and visualData.
Choices should include common misconceptions as distractors.
6 string choices per question.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.8,
      }
    });

    if (!response.text) throw new Error("No response from Gemini");

    const parsed: Omit<Question, 'id'>[] = JSON.parse(response.text);
    
    // add unique IDs
    return parsed.map((q) => ({
      ...q,
      id: Date.now().toString(36) + Math.random().toString(36).substring(2)
    }));
  } catch (err) {
    console.error("Gemini Generation Error:", err);
    throw new Error("Failed to generate test questions. Please try again.");
  }
};

export const generateParentSummary = async (
  result: TestResult
): Promise<string> => {
  const breakdownStr = result.topicBreakdown
    .map(t => `- ${t.topic}: ${t.percentage}% (${t.status})`)
    .join('\n');

  const targetsStr = result.suggestedTargets.length > 0
    ? result.suggestedTargets.map(t => `- ${t}`).join('\n')
    : 'None, excellent performance across the board.';

  const prompt = `You are a professional, encouraging maths tutor.
Write a detailed, comprehensive report for the parent of a student named ${result.studentFirstName} who just completed a ${result.testLevel} Maths diagnostic test.
They scored ${result.score}/${result.totalQuestions} (${result.percentage}%).

Here is the breakdown by topic:
${breakdownStr}

Here is a list of suggested targets for improvement:
${targetsStr}

Write a detailed multi-paragraph report (3-4 paragraphs) that:
1. Warmly congratulates the student on completing the test and sets a positive, encouraging tone.
2. Analyzes their detailed performance based on the specific topics. Highlight their areas of strength and explicitly identify areas that need more focus.
3. Outlines the specific path forward based on the suggested targets (how you will help them in future lessons).

Make sure the tone is professional, reassuring, and clearly points out actionable insight. Do NOT include generic greetings like "Dear [Parent]", just start the message directly ("Hi, thank you for completing...").
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: prompt,
    });
    return response.text?.trim() || "";
  } catch (err) {
    console.error("Gemini Summary Error:", err);
    return `Hi, thank you for completing the diagnostic test. I have reviewed the result. We will discuss the next steps and areas of focus in our first lesson.`;
  }
};
