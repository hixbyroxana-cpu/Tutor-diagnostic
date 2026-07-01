import { Question, TestLevel, TestResultDraft, TopicBreakdown } from '../types';

export interface MarkableTest {
  id?: string;
  slug: string;
  title: string;
  level: TestLevel;
  questions: Question[];
}

export interface StudentResultInfo {
  studentFirstName: string;
  studentLastName: string;
  parentName?: string;
  parentEmail?: string;
  notes?: string;
}

export function calculateTestResults(
  test: MarkableTest,
  answers: Record<string, string>,
  studentInfo: StudentResultInfo,
): TestResultDraft {
  let score = 0;
  const questionResults = test.questions.map((q) => {
    const selected = answers[q.id] || "";
    const isCorrect = selected === q.correctAnswer;
    if (isCorrect) score++;

    return {
      questionId: q.id,
      question: q.question,
      selectedAnswer: selected,
      correctAnswer: q.correctAnswer,
      isCorrect,
      topic: q.topic,
      target: q.target,
    };
  });

  const percentage = Math.round((score / test.questions.length) * 100);

  const topicsMap: Record<string, { total: number; correct: number }> = {};
  questionResults.forEach((qr) => {
    if (!topicsMap[qr.topic]) {
      topicsMap[qr.topic] = { total: 0, correct: 0 };
    }
    topicsMap[qr.topic].total++;
    if (qr.isCorrect) {
      topicsMap[qr.topic].correct++;
    }
  });

  const topicBreakdown: TopicBreakdown[] = Object.entries(topicsMap).map(([topic, stats]) => {
    const p = Math.round((stats.correct / stats.total) * 100);
    let status: 'weak' | 'developing' | 'secure' = 'weak';
    if (p >= 80) status = 'secure';
    else if (p >= 60) status = 'developing';

    return {
      topic,
      total: stats.total,
      correct: stats.correct,
      percentage: p,
      status,
    };
  });

  const weakTopics = topicBreakdown.filter(t => t.status === 'weak').map(t => t.topic);

  // Collect unique targets from incorrectly answered questions
  const uniqueTargets = new Set<string>();
  questionResults.forEach((qr) => {
    if (!qr.isCorrect && qr.target) {
      uniqueTargets.add(qr.target);
    }
  });

  return {
    testId: test.id ?? "",
    testSlug: test.slug,
    testTitle: test.title,
    testLevel: test.level,
    studentFirstName: studentInfo.studentFirstName,
    studentLastName: studentInfo.studentLastName,
    studentFullName: `${studentInfo.studentFirstName} ${studentInfo.studentLastName}`,
    parentName: studentInfo.parentName,
    parentEmail: studentInfo.parentEmail,
    notes: studentInfo.notes || "",
    score,
    totalQuestions: test.questions.length,
    percentage,
    answers: questionResults,
    topicBreakdown,
    weakTopics,
    suggestedTargets: Array.from(uniqueTargets),
    parentSummary: "", // Will be filled via Gemini later
  };
}
