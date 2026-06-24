import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db, doc, getDoc, updateDoc } from '../firebase';
import { TestResult } from '../types';
import { generateParentSummary } from '../services/gemini';
import { downloadDiagnosticReportPdf, downloadLearningPlanPdf } from '../lib/pdf';
import { ArrowLeft, RefreshCw, Mail, Target, AlertTriangle, CheckCircle2, Copy, Download, FileText, CalendarDays } from 'lucide-react';

function buildStructuredParentMessage(result: TestResult) {
  const secureTopics = result.topicBreakdown.filter(topic => topic.status === 'secure');
  const developingTopics = result.topicBreakdown.filter(topic => topic.status === 'developing');
  const weakTopics = result.topicBreakdown.filter(topic => topic.status === 'weak');
  const strengths = secureTopics.length
    ? secureTopics.slice(0, 3).map(topic => `${topic.topic}: ${topic.percentage}% (${topic.correct}/${topic.total})`)
    : developingTopics.length
      ? developingTopics.slice(0, 3).map(topic => `${topic.topic}: developing at ${topic.percentage}% (${topic.correct}/${topic.total})`)
      : ['Completed the diagnostic, giving a clear baseline for future lessons.'];
  const areasToStrengthen = [...weakTopics, ...developingTopics].slice(0, 3);

  return [
    'Overview',
    `${result.studentFirstName} has completed the ${result.testLevel} diagnostic. This gives a clear baseline for future lessons and helps identify where focused support will make the biggest difference.`,
    '',
    'Score Snapshot',
    `${result.score}/${result.totalQuestions} correct (${result.percentage}%). This should be read as a diagnostic starting point, showing which skills are currently secure and which need more guided practice.`,
    '',
    'Strengths',
    'The main positives from this diagnostic are:',
    ...strengths.map(item => `- ${item}`),
    '',
    'Areas To Strengthen',
    'These are the areas where focused teaching and practice should have the greatest impact:',
    ...(areasToStrengthen.length
      ? areasToStrengthen.map(topic => `- ${topic.topic}: ${topic.percentage}% (${topic.correct}/${topic.total}). This should be prioritised so the method becomes more confident and reliable.`)
      : ['- No major weak areas were identified. Continue with extension and mixed practice.']),
    '',
    'Suggested Targets',
    'The next targets should turn these gaps into practical lesson priorities:',
    ...(result.suggestedTargets.length
      ? result.suggestedTargets.map(target => `- ${target}`)
      : ['- No major targets identified.']),
  ].join('\n');
}

export default function ResultDetail() {
  const { id } = useParams();
  const [result, setResult] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function loadResult() {
      if (!id) return;
      try {
        const snap = await getDoc(doc(db, 'testResults', id));
        if (snap.exists()) {
          const data = snap.data() as TestResult;
          setResult(data);
          
          // Auto-generate parent summary if it doesn't exist
          if (!data.parentSummary) {
            generateSummary(data);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadResult();
  }, [id]);

  const generateSummary = async (data: TestResult) => {
    if (!id) return;
    setGeneratingSummary(true);
    try {
      const summary = await generateParentSummary(data);
      
      await updateDoc(doc(db, 'testResults', id), { parentSummary: summary });
      setResult(prev => prev ? { ...prev, parentSummary: summary } : null);
    } catch (err) {
      console.error('Failed to generate summary', err);
    } finally {
      setGeneratingSummary(false);
    }
  };

  const copySummary = () => {
    if (result) {
      navigator.clipboard.writeText(buildStructuredParentMessage(result));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) return <div className="animate-pulse p-8">Loading result...</div>;
  if (!result) return <div className="p-8">Result not found.</div>;

  const secureTopics = result.topicBreakdown.filter(topic => topic.status === 'secure');
  const developingTopics = result.topicBreakdown.filter(topic => topic.status === 'developing');
  const weakTopics = result.topicBreakdown.filter(topic => topic.status === 'weak');
  const strengths = secureTopics.length
    ? secureTopics.slice(0, 3).map(topic => `${topic.topic}: ${topic.percentage}% (${topic.correct}/${topic.total})`)
    : developingTopics.length
      ? developingTopics.slice(0, 3).map(topic => `${topic.topic}: developing at ${topic.percentage}% (${topic.correct}/${topic.total})`)
      : ['Completed the diagnostic, giving a clear baseline for future lessons.'];
  const areasToStrengthen = [...weakTopics, ...developingTopics].slice(0, 3);
  const reportTargets = result.suggestedTargets;
  const priorityTargets = result.suggestedTargets.length
    ? result.suggestedTargets
    : ['Maintain fluency and confidence across the topics covered in this diagnostic.'];
  const totalLessons = priorityTargets.length + 1;
  const revisionForLesson = (index: number) => {
    if (index === 0) {
      return 'We will begin by revisiting the relevant basics from the diagnostic before introducing the lesson focus.';
    }

    return `We will briefly revisit Lesson ${index}'s focus (${priorityTargets[index - 1]}) so the previous skill supports the new topic.`;
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-24">
      <div>
        <Link to="/results" className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1 mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Results
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">{result.studentFullName}</h1>
        <p className="text-slate-500 mt-1 flex gap-2 items-center">
          <span>{result.testTitle} ({result.testLevel})</span>
          <span>•</span>
          <span>{new Date(result.completedAt).toLocaleString()}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Col */}
        <div className="space-y-6 md:col-span-1">
          {/* Main Score Modal */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm text-center">
            <div className={`text-5xl font-extrabold ${result.percentage >= 80 ? 'text-green-500' : result.percentage >= 60 ? 'text-amber-500' : 'text-red-500'}`}>
              {result.percentage}%
            </div>
            <div className="text-slate-500 mt-2 font-medium">
              {result.score} out of {result.totalQuestions}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="font-semibold text-slate-900 border-b pb-2">Student Info</h3>
            <div>
              <div className="text-xs text-slate-500 font-medium">Parent</div>
              <div className="text-sm text-slate-900">{result.parentName}</div>
              <a href={`mailto:${result.parentEmail}`} className="text-sm text-blue-600 hover:underline">{result.parentEmail}</a>
            </div>
            {result.notes && (
              <div>
                <div className="text-xs text-slate-500 font-medium">Notes</div>
                <div className="text-sm text-slate-900 bg-slate-50 p-2 rounded border mt-1">{result.notes}</div>
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-3">
            <h3 className="font-semibold text-slate-900 border-b pb-2">Downloads</h3>
            <button
              onClick={() => downloadDiagnosticReportPdf(result)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 px-3 rounded-lg flex justify-center items-center gap-2 text-sm font-medium transition"
            >
              <FileText className="w-4 h-4" />
              Download Report PDF
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={() => downloadLearningPlanPdf(result)}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white py-2.5 px-3 rounded-lg flex justify-center items-center gap-2 text-sm font-medium transition"
            >
              <CalendarDays className="w-4 h-4" />
              Download Learning Plan PDF
              <Download className="w-4 h-4" />
            </button>
          </div>

          <div className="bg-slate-900 text-white rounded-xl p-6 shadow-sm space-y-4 relative">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-400" />
                Structured Report Draft
              </h3>
              <button 
                onClick={() => generateSummary(result)} 
                disabled={generatingSummary}
                className="text-slate-400 hover:text-white transition"
                title="Regenerate Structured Report"
              >
                <RefreshCw className={`w-4 h-4 ${generatingSummary ? 'animate-spin' : ''}`} />
              </button>
            </div>
            {generatingSummary ? (
              <div className="text-sm text-slate-400 animate-pulse">Drafting structured report with AI...</div>
            ) : (
              <>
                <div className="space-y-5 text-sm leading-relaxed text-slate-300">
                  <section>
                    <h4 className="text-white font-semibold mb-1">Overview</h4>
                    <p>
                      {result.studentFirstName} has completed the {result.testLevel} diagnostic. This gives a clear baseline for future lessons and helps identify where focused support will make the biggest difference.
                    </p>
                  </section>

                  <section>
                    <h4 className="text-white font-semibold mb-1">Score Snapshot</h4>
                    <p>
                      {result.score}/{result.totalQuestions} correct ({result.percentage}%). This should be read as a diagnostic starting point, showing which skills are currently secure and which need more guided practice.
                    </p>
                  </section>

                  <section>
                    <h4 className="text-white font-semibold mb-1">Strengths</h4>
                    <p className="mb-2">The main positives from this diagnostic are:</p>
                    <ul className="list-disc pl-5 space-y-1">
                      {strengths.map((item, index) => <li key={index}>{item}</li>)}
                    </ul>
                  </section>

                  <section>
                    <h4 className="text-white font-semibold mb-1">Areas To Strengthen</h4>
                    <p className="mb-2">These are the areas where focused teaching and practice should have the greatest impact:</p>
                    {areasToStrengthen.length ? (
                      <ul className="list-disc pl-5 space-y-1">
                        {areasToStrengthen.map(topic => (
                          <li key={topic.topic}>
                            {topic.topic}: {topic.percentage}% ({topic.correct}/{topic.total}). This should be prioritised so the method becomes more confident and reliable.
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>No major weak areas were identified. Continue with extension and mixed practice.</p>
                    )}
                  </section>

                  <section>
                    <h4 className="text-white font-semibold mb-1">Suggested Targets</h4>
                    <p className="mb-2">The next targets should turn these gaps into practical lesson priorities:</p>
                    {reportTargets.length ? (
                      <ul className="list-disc pl-5 space-y-1">
                        {reportTargets.map((target, index) => <li key={index}>{target}</li>)}
                      </ul>
                    ) : (
                      <p>No major targets identified.</p>
                    )}
                  </section>
                </div>
                <button 
                  onClick={copySummary}
                  className="w-full mt-2 bg-blue-500 hover:bg-blue-600 text-white py-2 rounded flex justify-center items-center gap-2 text-sm transition"
                >
                  {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied' : 'Copy Message'}
                </button>
              </>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-5">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-blue-500" />
              Learning Plan Preview
            </h3>

            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-900">
              Suggested duration: <strong>{totalLessons} lessons</strong>. Each target becomes a lesson focus, with revision built in before each new topic and a final reassessment lesson at the end.
            </div>

            <section className="space-y-4">
              <h4 className="text-sm font-semibold text-slate-800">Lesson Sequence</h4>
              {priorityTargets.map((target, index) => (
                <div key={index} className="border border-slate-200 rounded-lg p-3 space-y-2">
                  <h5 className="text-sm font-semibold text-slate-900">Lesson {index + 1}: {target}</h5>
                  <p className="text-sm text-slate-600">
                    <span className="text-sm font-semibold text-slate-900">Revision:</span> {revisionForLesson(index)}
                  </p>
                  <p className="text-sm text-slate-600">
                    <span className="text-sm font-semibold text-slate-900">Focus:</span> In this lesson we will work on this target through clear examples, guided practice, and a few independent questions: {target}
                  </p>
                </div>
              ))}
            </section>

            <section className="space-y-2">
              <h4 className="text-sm font-semibold text-slate-800">Lesson {totalLessons}: Reassessment and Next Steps</h4>
              <p className="text-sm text-slate-600">
                <span className="text-sm font-semibold text-slate-900">Revision:</span> We will revisit the main targets from the plan and look back at the skills that needed the most support.
              </p>
              <p className="text-sm text-slate-600">
                <span className="text-sm font-semibold text-slate-900">Focus:</span> The student will complete another test or short diagnostic. We will compare it with the original result to identify remaining gaps, newly secure skills, and any new areas for improvement.
              </p>
            </section>

            <section className="space-y-2">
              <h4 className="text-sm font-semibold text-slate-800">Follow-Up Actions</h4>
              <ul className="list-disc pl-5 space-y-1 text-sm text-slate-700">
                <li>Each lesson includes a short revision section before the new focus.</li>
                <li>The parent can use the lesson titles to see which targets are being covered.</li>
                <li>The last lesson uses another test or targeted reassessment to decide the next priorities.</li>
              </ul>
            </section>
          </div>
        </div>

        {/* Right Col */}
        <div className="space-y-6 md:col-span-2">
          
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2 text-lg">
              <Target className="w-5 h-5 text-blue-500" />
              Diagnostic Overview
            </h3>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-3">Topic Breakdown</h4>
                <div className="space-y-3">
                  {result.topicBreakdown.map(tb => (
                    <div key={tb.topic}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-slate-800">{tb.topic}</span>
                        <span className={tb.status === 'secure' ? 'text-green-600' : tb.status === 'weak' ? 'text-red-600' : 'text-amber-600'}>
                          {tb.percentage}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div 
                          className={`h-2 rounded-full ${tb.status === 'secure' ? 'bg-green-500' : tb.status === 'weak' ? 'bg-red-500' : 'bg-amber-500'}`} 
                          style={{ width: `${tb.percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-3">Suggested Targets</h4>
                {result.suggestedTargets.length === 0 ? (
                  <p className="text-sm text-slate-500">No major targets identified.</p>
                ) : (
                  <ul className="space-y-2">
                    {result.suggestedTargets.map((t, i) => (
                      <li key={i} className="text-sm text-slate-700 flex items-start gap-2 bg-blue-50 p-2 rounded-md border border-blue-100">
                        <ArrowRight className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                Detailed Answers
              </h3>
            </div>
            <div className="divide-y divide-slate-100">
              {result.answers.map((ans, i) => (
                <div key={ans.questionId} className="p-4 sm:p-6 hover:bg-slate-50 transition">
                  <div className="flex gap-4">
                    <div className="shrink-0 mt-0.5">
                      {ans.isCorrect 
                        ? <CheckCircle2 className="w-5 h-5 text-green-500" />
                        : <AlertTriangle className="w-5 h-5 text-red-500" />
                      }
                    </div>
                    <div className="flex-1 space-y-2">
                      <p className="text-sm font-medium text-slate-900"><span className="text-slate-400 mr-2">{i+1}.</span>{ans.question}</p>
                      
                      <div className="text-sm">
                        {!ans.isCorrect && (
                          <div className="text-red-600 bg-red-50 px-2 py-1 flex inline-flex rounded mt-1 mr-2 border border-red-100">
                            <span className="font-semibold mr-1">Student:</span> {ans.selectedAnswer || 'Skipped'}
                          </div>
                        )}
                        <div className="text-green-700 bg-green-50 px-2 py-1 flex inline-flex rounded mt-1 border border-green-100">
                          <span className="font-semibold mr-1">Correct:</span> {ans.correctAnswer}
                        </div>
                      </div>
                      
                      <div className="flex gap-2 pt-2 text-xs">
                        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">{ans.topic}</span>
                        {!ans.isCorrect && ans.target && (
                          <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded">Target: {ans.target}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// Icon helper
function ArrowRight(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}
