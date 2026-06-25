import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { db, collection, getDocs, query, where, addDoc } from '../firebase';
import { LegacyTest, LegacyTestResult, Question } from '../types';
import { calculateTestResults } from '../lib/marking';

import QuestionVisualizer from '../components/QuestionVisualizer';

export default function PublicTestRunner() {
  const { slug } = useParams();
  const [test, setTest] = useState<LegacyTest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // State: 'intro', 'testing', 'completed'
  const [stage, setStage] = useState<'intro' | 'testing' | 'completed'>('intro');
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [studentFirstName, setStudentFirstName] = useState('');
  const [studentLastName, setStudentLastName] = useState('');
  const [parentEmail, setParentEmail] = useState('');

  // Answers State: question id -> selected choice
  const [answers, setAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    async function loadTest() {
      try {
        const q = query(collection(db, 'tests'), where('slug', '==', slug), where('isActive', '==', true));
        const snap = await getDocs(q);
        if (snap.empty) {
          setError('Test not found or no longer active.');
        } else {
          setTest({ id: snap.docs[0].id, ...snap.docs[0].data() } as LegacyTest);
        }
      } catch (err) {
        console.error(err);
        setError('Failed to load test.');
      } finally {
        setLoading(false);
      }
    }
    loadTest();
  }, [slug]);

  const handleStart = (e: FormEvent) => {
    e.preventDefault();
    setStage('testing');
    window.scrollTo(0, 0);
  };

  const handleSelectAnswer = (qId: string, choice: string) => {
    setAnswers(prev => ({ ...prev, [qId]: choice }));
  };

  const handleSubmit = async () => {
    if (!test) return;
    
    // Quick validation check
    const answeredCount = Object.keys(answers).length;
    if (answeredCount < test.questions.length) {
      if (!window.confirm(`You have only answered ${answeredCount} out of ${test.questions.length} questions. Are you sure you want to construct?`)) {
        return;
      }
    }

    setSubmitting(true);
    try {
      // Auto-mark and generate result
      const resultData = calculateTestResults(test, answers, {
        studentFirstName,
        studentLastName,
        parentName: '',
        parentEmail,
        notes: ''
      });

      const finalResult: LegacyTestResult = {
        ...resultData,
        completedAt: Date.now(),
        isNew: true,
      };

      await addDoc(collection(db, 'testResults'), finalResult);
      setStage('completed');
      window.scrollTo(0, 0);
    } catch (err) {
      console.error(err);
      alert('Failed to submit test. Please try again.');
      setSubmitting(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">Loading...</div>;
  
  if (error || !test) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-xl shadow border border-red-100 text-center max-w-md">
        <h2 className="text-xl font-bold text-slate-900 mb-2">Unavailable</h2>
        <p className="text-slate-500">{error}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        
        {stage === 'intro' && (
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
            <div className="bg-slate-900 px-8 py-12 text-center text-white">
              <h1 className="text-3xl font-bold tracking-tight mb-3">{test.title}</h1>
              <span className="inline-block bg-white/10 text-slate-200 px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wider border border-white/20">
                Level: {test.level}
              </span>
            </div>
            <div className="p-8">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 mb-8 text-center text-blue-900 text-sm leading-relaxed">
                Welcome to your Maths diagnostic test! Please answer all questions by selecting the single best option. 
                There is no strict time limit, but we recommend taking around <strong>30-45 minutes</strong> to complete the test.
                <br /><br />
                Enter the student details below to begin. Good luck!
              </div>
              
              <form onSubmit={handleStart} className="space-y-5">
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Student First Name *</label>
                    <input required type="text" value={studentFirstName} onChange={e => setStudentFirstName(e.target.value)} className="w-full border-slate-200 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 border p-3" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Student Last Name *</label>
                    <input required type="text" value={studentLastName} onChange={e => setStudentLastName(e.target.value)} className="w-full border-slate-200 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 border p-3" />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Parent/Guardian Email (optional)</label>
                  <input type="email" value={parentEmail} onChange={e => setParentEmail(e.target.value)} className="w-full border-slate-200 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 border p-3" />
                </div>

                <div className="pt-6">
                  <button type="submit" className="bg-blue-600 w-full text-white font-bold py-3 px-4 rounded-xl hover:bg-blue-700 transition">
                    Start Test
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {stage === 'testing' && (
          <div className="space-y-8 pb-20">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 sticky top-4 z-10">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-slate-900">{test.title}</h2>
                <div className="text-sm font-medium bg-slate-100 text-slate-600 px-3 py-1 rounded-md">
                  Answered: {Object.keys(answers).length} / {test.questions.length}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {test.questions.map((q, idx) => (
                <div key={q.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8">
                  <h3 className="text-lg font-medium text-slate-900 mb-6">
                    <span className="text-slate-400 mr-3">{idx + 1}.</span>
                    {q.question}
                  </h3>
                  
                  <QuestionVisualizer type={q.visualType} data={q.visualData} />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {q.choices.map((choice, cIdx) => {
                      const isSelected = answers[q.id] === choice;
                      return (
                        <button
                          key={cIdx}
                          onClick={() => handleSelectAnswer(q.id, choice)}
                          className={`
                            flex items-center text-left px-5 py-4 rounded-xl border-2 transition-all
                            ${isSelected 
                              ? 'border-blue-600 bg-blue-50 text-blue-900' 
                              : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50 text-slate-700'
                            }
                          `}
                        >
                          <div className={`w-5 h-5 rounded-full border flex items-center justify-center mr-3 shrink-0 transition-colors
                            ${isSelected ? 'border-blue-600' : 'border-slate-300'}
                          `}>
                            {isSelected && <div className="w-2.5 h-2.5 bg-blue-600 rounded-full" />}
                          </div>
                          <span className="font-medium">{choice}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center mt-8">
              <h3 className="text-xl font-bold text-slate-900 mb-2">Ready to submit?</h3>
              <p className="text-slate-500 mb-6">Please check your answers before submitting.</p>
              <button 
                onClick={handleSubmit}
                disabled={submitting}
                className="bg-blue-600 text-white font-bold py-3 px-8 rounded-xl hover:bg-blue-700 transition shadow hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed text-lg w-full md:w-auto"
              >
                {submitting ? 'Submitting Test...' : 'Submit Test'}
              </button>
            </div>
          </div>
        )}

        {stage === 'completed' && (
          <div className="bg-white p-12 rounded-2xl shadow-xl border border-slate-100 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-3xl font-extrabold text-slate-900 mb-4">Thank you.</h2>
            <p className="text-lg text-slate-600">Your test has been submitted successfully.</p>
            <p className="text-slate-500 mt-2">You may safely close this page.</p>
          </div>
        )}
        
      </div>
    </div>
  );
}
