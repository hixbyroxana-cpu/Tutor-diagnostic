import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db, doc, getDoc, updateDoc } from '../firebase';
import { TestResult } from '../types';
import { generateParentSummary } from '../services/gemini';
import { ArrowLeft, RefreshCw, Mail, Target, AlertTriangle, CheckCircle2, Copy } from 'lucide-react';

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
      const summary = await generateParentSummary(
        data.studentFirstName,
        data.testLevel,
        data.score,
        data.percentage,
        data.weakTopics
      );
      
      await updateDoc(doc(db, 'testResults', id), { parentSummary: summary });
      setResult(prev => prev ? { ...prev, parentSummary: summary } : null);
    } catch (err) {
      console.error('Failed to generate summary', err);
    } finally {
      setGeneratingSummary(false);
    }
  };

  const copySummary = () => {
    if (result?.parentSummary) {
      navigator.clipboard.writeText(result.parentSummary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) return <div className="animate-pulse p-8">Loading result...</div>;
  if (!result) return <div className="p-8">Result not found.</div>;

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

          <div className="bg-slate-900 text-white rounded-xl p-6 shadow-sm space-y-4 relative">
            <h3 className="font-semibold flex items-center gap-2">
              <Mail className="w-4 h-4 text-blue-400" />
              Parent Summary
            </h3>
            {generatingSummary ? (
              <div className="text-sm text-slate-400 animate-pulse">Drafting summary with AI...</div>
            ) : (
              <>
                <div className="text-sm leading-relaxed text-slate-300">
                  {result.parentSummary}
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
                    {result.suggestedTargets.slice(0, 5).map((t, i) => (
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
