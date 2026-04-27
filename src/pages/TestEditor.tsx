import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, Sparkles, Trash2, Plus, GripVertical, ChevronDown, ChevronRight, AlertCircle, Image as ImageIcon } from 'lucide-react';
import { db, doc, getDoc, collection, addDoc, updateDoc } from '../firebase';
import { Test, TestLevel, Question, QuestionDifficulty, VisualAspectType } from '../types';
import { generateDiagnosticTest, generateSpecificQuestions } from '../services/gemini';
import QuestionVisualizer from '../components/QuestionVisualizer';

const LEVELS: TestLevel[] = ['Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6', '11+', 'KS3', 'GCSE Foundation', 'GCSE Higher', 'A-Level', 'Adult'];

export default function TestEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  
  const [title, setTitle] = useState('');
  const [level, setLevel] = useState<TestLevel>('KS3');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [aiDrafts, setAiDrafts] = useState<Question[]>([]);
  const [genPrompt, setGenPrompt] = useState('');
  const [genCount, setGenCount] = useState(1);
  const [expandedQs, setExpandedQs] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (id) {
      getDoc(doc(db, 'tests', id)).then((snap) => {
        if (snap.exists()) {
          const data = snap.data() as Test;
          setTitle(data.title);
          setLevel(data.level);
          setSlug(data.slug);
          setDescription(data.description);
          setAiPrompt(data.aiPrompt || '');
          setQuestions(data.questions || []);
        } else {
          setError('Test not found');
        }
        setLoading(false);
      });
    }
  }, [id]);

  const handleGenerateFull = async () => {
    if (!level) return;
    setGenerating(true);
    setError('');
    try {
      const qs = await generateDiagnosticTest(level, aiPrompt);
      setAiDrafts(qs);
      setExpandedQs(new Set([qs[0].id])); // Expand first one to show it worked
    } catch (err: any) {
      setError(err.message || 'Error generating test');
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateSpecific = async () => {
    if (!level || !genPrompt.trim()) return;
    setGenerating(true);
    setError('');
    try {
      const qs = await generateSpecificQuestions(level, genPrompt, genCount);
      setAiDrafts(prev => [...prev, ...qs]);
      setExpandedQs(prev => new Set(prev).add(qs[0].id));
      setGenPrompt('');
    } catch (err: any) {
      setError(err.message || 'Error generating questions');
    } finally {
      setGenerating(false);
    }
  };

  const approveDraft = (qId: string) => {
    const draft = aiDrafts.find(q => q.id === qId);
    if (draft) {
      setQuestions(prev => [...prev, draft]);
      setAiDrafts(prev => prev.filter(q => q.id !== qId));
    }
  };

  const discardDraft = (qId: string) => {
    setAiDrafts(prev => prev.filter(q => q.id !== qId));
  };
  
  const updateDraft = (qId: string, field: keyof Question, value: any) => {
    setAiDrafts(qs => qs.map(q => q.id === qId ? { ...q, [field]: value } : q));
  };

  const updateDraftChoice = (qId: string, idx: number, value: string) => {
    setAiDrafts(qs => qs.map(q => {
      if (q.id !== qId) return q;
      const newChoices = [...q.choices];
      newChoices[idx] = value;
      return { ...q, choices: newChoices };
    }));
  };

  const handleSave = async () => {
    const finalQuestions = [...questions, ...aiDrafts];
    
    if (!title || !slug || finalQuestions.length === 0) {
      setError('Title, slug, and at least 1 question are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const p: Test = {
        title,
        level,
        slug,
        description,
        aiPrompt,
        questions: finalQuestions,
        createdAt: id ? undefined : Date.now(),
        updatedAt: Date.now(),
        isActive: true,
      } as Test;

      if (id) {
        await updateDoc(doc(db, 'tests', id), p as any);
      } else {
        await addDoc(collection(db, 'tests'), p);
      }
      navigate('/tests');
    } catch (err: any) {
      setError(err.message || 'Error saving test');
      setSaving(false);
    }
  };

  const toggleExpand = (qId: string) => {
    const next = new Set(expandedQs);
    if (next.has(qId)) next.delete(qId);
    else next.add(qId);
    setExpandedQs(next);
  };

  const updateQuestion = (qId: string, field: keyof Question, value: any) => {
    setQuestions(qs => qs.map(q => q.id === qId ? { ...q, [field]: value } : q));
  };

  const updateChoice = (qId: string, idx: number, value: string) => {
    setQuestions(qs => qs.map(q => {
      if (q.id !== qId) return q;
      const newChoices = [...q.choices];
      newChoices[idx] = value;
      return { ...q, choices: newChoices };
    }));
  };

  const deleteQuestion = (qId: string) => {
    setQuestions(qs => qs.filter(q => q.id !== qId));
  };

  const addQuestion = () => {
    const newId = Date.now().toString(36) + Math.random().toString(36).substring(2);
    setQuestions([...questions, {
      id: newId,
      question: '',
      choices: ['', '', '', '', '', ''],
      correctAnswer: '',
      topic: '',
      skill: '',
      difficulty: 'medium',
      explanation: '',
      target: ''
    }]);
    setExpandedQs(prev => new Set(prev).add(newId));
  };

  if (loading) return <div className="animate-pulse">Loading...</div>;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{id ? 'Edit Test' : 'New Test'}</h1>
        </div>
        <button 
          onClick={handleSave}
          disabled={saving}
          className="bg-slate-900 text-white px-6 py-2 rounded-xl font-bold hover:bg-slate-800 transition flex items-center gap-2 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Test'}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-3 lg:col-span-1 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
            <h2 className="font-semibold text-slate-900">Test Details</h2>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
              <input 
                type="text" 
                value={title} 
                onChange={e => setTitle(e.target.value)} 
                className="w-full border-slate-200 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 border p-2" 
                placeholder="e.g. Year 6 Initial Diagnostic" 
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Level</label>
              <select 
                value={level} 
                onChange={e => setLevel(e.target.value as TestLevel)} 
                className="w-full border-slate-200 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 border p-2 bg-white"
              >
                {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">URL Slug</label>
              <div className="flex bg-slate-50 border border-slate-300 rounded-md overflow-hidden shadow-sm">
                <span className="bg-slate-100 text-slate-500 px-3 py-2 border-r border-slate-300 text-sm flex items-center">/test/</span>
                <input 
                  type="text" 
                  value={slug} 
                  onChange={e => setSlug(e.target.value)} 
                  className="w-full focus:ring-0 border-none p-2" 
                  placeholder="e.g. get-ready-for-year-6" 
                />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-3 text-blue-800">
              <Sparkles className="w-5 h-5" />
              <h2 className="font-bold text-lg">AI Generation</h2>
            </div>
            <div className="space-y-4">
              <div className="bg-white/60 p-4 rounded-xl border border-blue-100">
                <h3 className="text-sm font-bold text-blue-900 mb-2">Generate Full Test</h3>
                <p className="text-xs text-blue-700 mb-3 leading-relaxed">
                  Generate 20 diagnostic questions for {level}.
                </p>
                <div className="mb-4">
                  <label className="block text-xs font-bold text-blue-800 mb-1">Custom Prompt / Context (Optional)</label>
                  <textarea 
                    value={aiPrompt} 
                    onChange={e => setAiPrompt(e.target.value)} 
                    rows={2}
                    className="w-full border-blue-200 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 border p-2 text-sm" 
                    placeholder="E.g. Focus specifically on fractions and ratio. Don't include geometry." 
                  />
                </div>
                <button
                  onClick={handleGenerateFull}
                  disabled={generating}
                  className="bg-blue-600 w-full text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 text-sm"
                >
                  {generating ? 'Generating (approx 15s)...' : 'Generate Full Test'}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-3 lg:col-span-2 space-y-4">
          
          <div className="bg-white border text-sm border-blue-200 rounded-xl p-4 shadow-sm flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-blue-500 shrink-0" />
            <input 
              type="text" 
              value={genPrompt}
              onChange={e => setGenPrompt(e.target.value)}
              placeholder="Describe a question to generate with AI (e.g. word problem with fractions)"
              className="flex-1 bg-transparent border-none focus:ring-0 px-2 py-1 outline-none text-slate-800"
              onKeyDown={e => { if (e.key === 'Enter') handleGenerateSpecific(); }}
            />
            <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
               <select 
                value={genCount} 
                onChange={e => setGenCount(Number(e.target.value))}
                className="bg-transparent border-none text-slate-600 font-medium focus:ring-0 px-2 py-1 outline-none cursor-pointer"
              >
                {[1, 2, 3, 5].map(n => <option key={n} value={n}>{n} Qs</option>)}
              </select>
              <button
                onClick={handleGenerateSpecific}
                disabled={generating || !genPrompt.trim()}
                className="bg-blue-600 text-white font-bold py-1.5 px-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                {generating ? '...' : 'Create'}
              </button>
            </div>
          </div>

          {aiDrafts.length > 0 && (
            <div className="border border-green-200 bg-green-50/50 rounded-2xl p-4 shadow-sm mb-8 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-xl text-green-900 flex items-center gap-2">
                  AI Drafts
                  <span className="bg-green-200 text-green-800 text-xs px-2 py-0.5 rounded-full">{aiDrafts.length}</span>
                </h2>
                <div className="flex gap-2">
                  <button onClick={() => setAiDrafts([])} className="text-sm font-bold text-slate-500 hover:text-slate-700 px-3 py-1.5 transition">
                    Discard All
                  </button>
                  <button onClick={() => { setQuestions(p => [...p, ...aiDrafts]); setAiDrafts([]); }} className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold transition">
                    Approve All
                  </button>
                </div>
              </div>
              <div className="space-y-3">
                {aiDrafts.map((q, i) => {
                  const expanded = expandedQs.has(q.id);
                  return (
                    <div key={q.id} className="bg-white border-2 border-green-200 hover:border-green-300 rounded-xl shadow-sm overflow-hidden flex flex-col transition-colors">
                      <div 
                        className="flex items-center p-4 cursor-pointer" 
                        onClick={() => toggleExpand(q.id)}
                      >
                        <div className="flex items-center text-slate-400 mr-4">
                          {expanded ? <ChevronDown className="w-5 h-5 text-green-600" /> : <ChevronRight className="w-5 h-5 text-green-600" />}
                          <span className="font-bold text-slate-600 w-6 ml-2">{i + 1}.</span>
                        </div>
                        <div className="flex-1 truncate font-medium text-slate-800">
                          {q.question || 'Empty Question'}
                        </div>
                        <div className="ml-4 flex items-center gap-3">
                          <span className="inline-flex px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded-md font-medium">
                            {q.topic || 'No topic'}
                          </span>
                          <button 
                            onClick={(e) => { e.stopPropagation(); approveDraft(q.id); }}
                            className="px-3 py-1.5 text-green-700 bg-green-100 font-bold text-xs rounded-md hover:bg-green-200 transition"
                          >
                            Approve
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); discardDraft(q.id); }}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      
                      {expanded && (
                        <div className="p-5 border-t border-green-100 bg-green-50/30 space-y-5">
                          <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Question Text</label>
                            <textarea 
                              value={q.question} 
                              onChange={e => updateDraft(q.id, 'question', e.target.value)}
                              className="w-full border-slate-300 rounded-md shadow-sm p-2 text-sm"
                              rows={2}
                            />
                          </div>

                          {(q.visualType && q.visualType !== 'none') && (
                            <div className="bg-white p-4 rounded-xl border border-slate-200">
                              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                                <ImageIcon className="w-3 h-3" /> Visual Preview ({q.visualType})
                              </label>
                              <QuestionVisualizer type={q.visualType} data={q.visualData} />
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Options (Select Correct)</label>
                              <div className="space-y-2">
                                {q.choices.map((choice, cIdx) => (
                                  <div key={cIdx} className="flex items-center gap-2">
                                    <input 
                                      type="radio" 
                                      name={`correct_${q.id}`} 
                                      checked={q.correctAnswer === choice && choice !== ''} 
                                      onChange={() => updateDraft(q.id, 'correctAnswer', choice)} 
                                      className="text-blue-600 focus:ring-blue-500"
                                    />
                                    <input 
                                      type="text" 
                                      value={choice} 
                                      onChange={e => updateDraftChoice(q.id, cIdx, e.target.value)} 
                                      className="flex-1 border-slate-300 rounded-md shadow-sm p-1.5 text-sm"
                                      placeholder={`Choice ${cIdx + 1}`}
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="space-y-4">
                              <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Topic</label>
                                <input 
                                  type="text" 
                                  value={q.topic} 
                                  onChange={e => updateDraft(q.id, 'topic', e.target.value)}
                                  className="w-full border-slate-300 rounded-md shadow-sm p-1.5 text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Skill</label>
                                <input 
                                  type="text" 
                                  value={q.skill} 
                                  onChange={e => updateDraft(q.id, 'skill', e.target.value)}
                                  className="w-full border-slate-300 rounded-md shadow-sm p-1.5 text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Difficulty</label>
                                <select 
                                  value={q.difficulty}
                                  onChange={e => updateDraft(q.id, 'difficulty', e.target.value)}
                                  className="w-full border-slate-300 rounded-md shadow-sm p-1.5 text-sm bg-white"
                                >
                                  <option value="easy">Easy</option>
                                  <option value="medium">Medium</option>
                                  <option value="hard">Hard</option>
                                </select>
                              </div>
                            </div>
                          </div>

                         <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Explanation</label>
                              <textarea 
                                value={q.explanation} 
                                onChange={e => updateDraft(q.id, 'explanation', e.target.value)}
                                className="w-full border-slate-300 rounded-md shadow-sm p-2 text-sm"
                                rows={2}
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Suggested Target</label>
                              <textarea 
                                value={q.target} 
                                onChange={e => updateDraft(q.id, 'target', e.target.value)}
                                className="w-full border-slate-300 rounded-md shadow-sm p-2 text-sm"
                                rows={2}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <h2 className="font-bold text-xl text-slate-800 flex items-center gap-2">
              Questions 
              <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">{questions.length}</span>
            </h2>
            <button onClick={addQuestion} className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-lg text-sm font-bold transition flex items-center">
              <Plus className="w-4 h-4 mr-1" /> Add Manual
            </button>
          </div>

          {questions.length === 0 ? (
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-12 text-center text-slate-500 bg-slate-50">
              No questions yet. Click "Generate Test" or "Add Manual".
            </div>
          ) : (
            <div className="space-y-3">
              {questions.map((q, i) => {
                const expanded = expandedQs.has(q.id);
                return (
                  <div key={q.id} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
                    <div 
                      className="flex items-center p-4 cursor-pointer hover:bg-slate-50 transition" 
                      onClick={() => toggleExpand(q.id)}
                    >
                      <div className="flex items-center text-slate-400 mr-4">
                        {expanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                        <span className="font-bold text-slate-600 w-6 ml-2">{i + 1}.</span>
                      </div>
                      <div className="flex-1 truncate font-medium text-slate-800">
                        {q.question || 'Empty Question'}
                      </div>
                      <div className="ml-4 flex items-center gap-3">
                        <span className="inline-flex px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded-md font-medium">
                          {q.topic || 'No topic'}
                        </span>
                        <button 
                          onClick={(e) => { e.stopPropagation(); deleteQuestion(q.id); }}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    {expanded && (
                      <div className="p-5 border-t border-slate-100 bg-slate-50 space-y-5">
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Question Text</label>
                          <textarea 
                            value={q.question} 
                            onChange={e => updateQuestion(q.id, 'question', e.target.value)}
                            className="w-full border-slate-300 rounded-md shadow-sm p-2 text-sm"
                            rows={2}
                          />
                        </div>

                        {(q.visualType && q.visualType !== 'none') && (
                          <div className="bg-white p-4 rounded-xl border border-slate-200">
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                              <ImageIcon className="w-3 h-3" /> Visual Preview ({q.visualType})
                            </label>
                            <QuestionVisualizer type={q.visualType} data={q.visualData} />
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Options (Select Correct)</label>
                            <div className="space-y-2">
                              {q.choices.map((choice, cIdx) => (
                                <div key={cIdx} className="flex items-center gap-2">
                                  <input 
                                    type="radio" 
                                    name={`correct_${q.id}`} 
                                    checked={q.correctAnswer === choice && choice !== ''} 
                                    onChange={() => updateQuestion(q.id, 'correctAnswer', choice)} 
                                    className="text-blue-600 focus:ring-blue-500"
                                  />
                                  <input 
                                    type="text" 
                                    value={choice} 
                                    onChange={e => updateChoice(q.id, cIdx, e.target.value)} 
                                    className="flex-1 border-slate-300 rounded-md shadow-sm p-1.5 text-sm"
                                    placeholder={`Choice ${cIdx + 1}`}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-4">
                            <div>
                              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Topic</label>
                              <input 
                                type="text" 
                                value={q.topic} 
                                onChange={e => updateQuestion(q.id, 'topic', e.target.value)}
                                className="w-full border-slate-300 rounded-md shadow-sm p-1.5 text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Skill</label>
                              <input 
                                type="text" 
                                value={q.skill} 
                                onChange={e => updateQuestion(q.id, 'skill', e.target.value)}
                                className="w-full border-slate-300 rounded-md shadow-sm p-1.5 text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Difficulty</label>
                              <select 
                                value={q.difficulty}
                                onChange={e => updateQuestion(q.id, 'difficulty', e.target.value)}
                                className="w-full border-slate-300 rounded-md shadow-sm p-1.5 text-sm bg-white"
                              >
                                <option value="easy">Easy</option>
                                <option value="medium">Medium</option>
                                <option value="hard">Hard</option>
                              </select>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Explanation</label>
                            <textarea 
                              value={q.explanation} 
                              onChange={e => updateQuestion(q.id, 'explanation', e.target.value)}
                              className="w-full border-slate-300 rounded-md shadow-sm p-2 text-sm"
                              rows={2}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Suggested Target</label>
                            <textarea 
                              value={q.target} 
                              onChange={e => updateQuestion(q.id, 'target', e.target.value)}
                              className="w-full border-slate-300 rounded-md shadow-sm p-2 text-sm"
                              rows={2}
                              placeholder="If wrong, student should: Practise..."
                            />
                          </div>
                        </div>

                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
