export type QuestionDifficulty = 'easy' | 'medium' | 'hard';
export type TestLevel = 'Year 2' | 'Year 3' | 'Year 4' | 'Year 5' | 'Year 6' | '11+' | 'KS3' | 'GCSE Foundation' | 'GCSE Higher' | 'A-Level' | 'Adult';
export type NotificationStatus = 'pending' | 'sent' | 'failed';

export type VisualAspectType = 'none' | 'bar_chart' | 'pie_chart' | 'coordinate_grid' | 'l_shape';

export interface OwnedRecord {
  ownerId: string;
}

export interface VisualData {
  data?: { name: string; value: number }[]; // For pie/bar
  point?: { x: number; y: number }; // For coordinate grids
  points?: { x: number; y: number }[]; // For coordinate grids with multiple labelled points
  lShape?: {
    totalWidth: number;
    totalHeight: number;
    cutoutWidth: number;
    cutoutHeight: number;
    unit?: string;
  };
  xAxisLabel?: string;
  yAxisLabel?: string;
}

export interface Question {
  id: string; // generated client-side for tracking
  question: string;
  choices: string[]; // new AI/manual questions use 4; older saved tests may have 6
  correctAnswer: string;
  topic: string;
  skill: string;
  difficulty: QuestionDifficulty;
  explanation: string;
  target: string;
  visualType?: VisualAspectType;
  visualData?: VisualData;
}

export interface Test extends OwnedRecord {
  id?: string; // firestore id
  title: string;
  level: TestLevel;
  slug: string;
  description: string;
  aiPrompt?: string;
  questions: Question[];
  createdAt: number;
  updatedAt: number;
  isActive: boolean;
  templateSourceId?: string;
}

export type LegacyTest = Omit<Test, 'ownerId'> & {
  ownerId?: string;
};

export type TestCreatePayload = Omit<LegacyTest, 'id'>;

export type TestUpdatePayload = Omit<TestCreatePayload, 'createdAt'>;

export interface QuestionResult {
  questionId: string;
  question: string;
  selectedAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  topic: string;
  target: string;
}

export interface TopicBreakdown {
  topic: string;
  total: number;
  correct: number;
  percentage: number;
  status: 'weak' | 'developing' | 'secure'; // <60% | 60-79% | >=80%
}

export interface TestResult extends OwnedRecord {
  id?: string;
  testId: string;
  testSlug: string;
  testTitle: string;
  testLevel: TestLevel;
  studentFirstName: string;
  studentLastName: string;
  studentFullName: string;
  parentName: string;
  parentEmail: string;
  notes: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  answers: QuestionResult[];
  topicBreakdown: TopicBreakdown[];
  weakTopics: string[];
  suggestedTargets: string[];
  parentSummary: string;
  isNew: boolean;
  completedAt: number;
  submissionId: string;
  notificationStatus: NotificationStatus;
  notificationSentAt?: number;
  notificationError?: string;
}

export type LegacyTestResult = Omit<TestResult, 'ownerId' | 'submissionId' | 'notificationStatus'> & {
  ownerId?: string;
  submissionId?: string;
  notificationStatus?: NotificationStatus;
};

export type TestResultDraft = Omit<
  TestResult,
  | 'id'
  | 'isNew'
  | 'completedAt'
  | 'ownerId'
  | 'submissionId'
  | 'notificationStatus'
  | 'notificationSentAt'
  | 'notificationError'
>;

export interface TutorProfile {
  uid: string;
  email: string;
  displayName: string;
  createdAt: number;
  templatesProvisionedAt?: number;
}
