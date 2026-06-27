import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, Sparkles, Trash2, Plus, GripVertical, ChevronDown, ChevronRight, AlertCircle, Image as ImageIcon } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { db, doc, getDoc, collection, addDoc, updateDoc } from '../firebase';
import { LegacyTest, TestCreatePayload, TestUpdatePayload, TestLevel, Question, QuestionDifficulty, VisualAspectType } from '../types';
import { generateSpecificQuestions } from '../services/gemini';
import QuestionVisualizer from '../components/QuestionVisualizer';
import { useAuth } from '../auth/AuthProvider';
import { belongsToTutor, resolveTestSlug } from '../lib/ownership';
import { canEditOwnedRecord, shouldFilterByOwner } from '../lib/tutor-query';
import { isEditorRequestContextCurrent, type EditorRequestContext } from '../lib/editor-request-context';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const authRequired = import.meta.env.VITE_AUTH_REQUIRED;

const isPermissionLikeError = (err: unknown) => {
  const error = err as { code?: string; message?: string };
  const message = error.message?.toLowerCase() || '';

  return error.code === 'permission-denied' || message.includes('permission') || message.includes('missing or insufficient permissions');
};

const LEVELS: TestLevel[] = ['Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6', '11+', 'KS3', 'GCSE Foundation', 'GCSE Higher', 'A-Level', 'Adult'];
const OVERALL_REVISION = 'Overall revision';
const DEFAULT_11_PLUS_CHAPTERS = [
  OVERALL_REVISION,
  'Number - number and place value',
  'Number - addition, subtraction, multiplication and division',
  'Number - Fractions (including decimals and percentages)',
  'Ratio and proportion',
  'Algebra',
  'Measurement',
  'Geometry - properties of shapes',
  'Geometry - position and direction',
  'Statistics',
];
const DEFAULT_GCSE_HIGHER_CHAPTERS = [
  OVERALL_REVISION,
  'Paper 1 - Overall revision',
  'Paper 1 - Number: fraction arithmetic, recurring decimals, prime factors, negative and fractional indices, surds, standard form',
  'Paper 1 - Ratio: percentages, ratio notation, equations of proportion, density',
  'Paper 1 - Algebra: simplification, brackets, algebraic fractions, inequalities, equations, quadratics, graphs, gradients',
  'Paper 1 - Geometry: angles, triangle area, volume, surface area, Pythagoras, exact trig values, vector geometry',
  'Paper 1 - Probability: probability and independent combined events',
  'Paper 1 - Statistics: cumulative frequency, mean, interquartile range',
  'Paper 2 - Overall revision',
  'Paper 2 - Number: error intervals and calculator use',
  'Paper 2 - Ratio: area, depreciation, direct and inverse proportion, currency conversion, pressure',
  'Paper 2 - Algebra: simplification, factorisation, indices, linear/quadratic equations, coordinates, transformations of functions',
  'Paper 2 - Geometry: transformations, circle theorems, area of a rectangle, volume, sine and cosine rules',
  'Paper 2 - Probability: Venn diagrams and probability from a Venn diagram',
  'Paper 2 - Statistics: box plots, quartiles, comparing distributions, capture-recapture',
  'Paper 3 - Overall revision',
  'Paper 3 - Number: negative numbers, laws of indices, bounds, product rule for counting',
  'Paper 3 - Ratio: time, percentage decrease, depreciation, reverse percentage, ratio notation, direct proportion, average speed',
  'Paper 3 - Algebra: simplification, brackets, substitution, changing subject, expressions, simultaneous equations, straight line graphs',
  'Paper 3 - Geometry: circle theorems, trapezium area, similar triangles, Pythagoras, trigonometry, column vectors',
  'Paper 3 - Probability: dependent combined events',
  'Paper 3 - Statistics: frequency polygons and histograms',
];
const DEFAULT_GCSE_FOUNDATION_CHAPTERS = [
  OVERALL_REVISION,
  'Integers and place value',
  'Decimals',
  'Indices, powers and roots',
  'Factors, multiples and primes',
  'Algebra: the basics',
  'Expanding and factorising single brackets',
  'Expressions and substitution into formulae',
  'Tables',
  'Charts and graphs',
  'Pie charts',
  'Scatter graphs',
  'Fractions',
  'Fractions, decimals and percentages',
  'Percentages',
  'Equations',
  'Inequalities',
  'Sequences',
  'Properties of shapes, parallel lines and angle facts',
  'Interior and exterior angles of polygons',
  'Statistics and sampling',
  'The averages',
  'Perimeter and area',
  '3D forms and volume',
  'Real-life graphs',
  'Straight-line graphs',
  'Transformations I: translations, rotations and reflections',
  'Transformations II: enlargements and combinations',
  'Ratio',
  'Proportion',
  'Right-angled triangles: Pythagoras and trigonometry',
  'Probability I',
  'Probability II',
  'Multiplicative reasoning',
  'Plans and elevations',
  'Constructions, loci and bearings',
  'Quadratic equations: expanding and factorising',
  'Quadratic equations: graphs',
  'Circles, cylinders, cones and spheres',
  'Fractions and reciprocals',
  'Indices and standard form',
  'Similarity and congruence in 2D',
  'Vectors',
  'Rearranging equations, graphs of cubic and reciprocal functions and simultaneous equations',
];

const cleanCurriculumLine = (line: string) => line
  .trim()
  .replace(/^[-*•\d.)\s]+/, '')
  .replace(/\s+/g, ' ')
  .trim();

const isStandaloneCurriculumHeading = (line: string) =>
  /^(Ratio and proportion|Algebra|Measurement|Statistics)$/i.test(line);

const shouldSkipCurriculumLine = (line: string) =>
  !line ||
  /^11\+ Maths Curriculum$/i.test(line) ||
  /^(Students|Pupils) should be taught to:?$/i.test(line) ||
  /^This syllabus/i.test(line) ||
  /^www\./i.test(line) ||
  /^\d+$/.test(line);

const parseCurriculumChapters = (value: string) => {
  const lines = value
    .split(/\r?\n/)
    .map(cleanCurriculumLine)
    .filter(line => !shouldSkipCurriculumLine(line));

  const chapters: string[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const isHeading = line.includes(' - ') || isStandaloneCurriculumHeading(line);

    if (!isHeading) continue;

    let chapter = line;
    const next = lines[i + 1];
    const nextLooksLikeContinuation = next &&
      !next.includes(' - ') &&
      !isStandaloneCurriculumHeading(next) &&
      /^(and|percentages)/i.test(next);

    if (nextLooksLikeContinuation) {
      chapter = `${chapter} ${next}`;
      i += 1;
    }

    chapters.push(chapter);
  }

  return chapters.length > 0 ? chapters : lines;
};

const buildDefaultTitle = (level: TestLevel, chapter: string) => {
  if (level !== 'GCSE Foundation' && level !== 'GCSE Higher') return '';

  if (!chapter || chapter === OVERALL_REVISION) {
    return `${level} Overall Revision`;
  }

  return `${level} - ${chapter}`;
};

const extractTextFromPdf = async (file: File) => {
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const pageTexts: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const rows = new Map<number, { x: number; text: string }[]>();

    for (const item of content.items as any[]) {
      if (!('str' in item) || !item.str.trim()) continue;

      const y = Math.round(item.transform[5]);
      const x = item.transform[4];
      const row = rows.get(y) || [];
      row.push({ x, text: item.str.trim() });
      rows.set(y, row);
    }

    const text = [...rows.entries()]
      .sort(([a], [b]) => b - a)
      .map(([, row]) => row
        .sort((a, b) => a.x - b.x)
        .map(item => item.text)
        .join(' ')
      )
      .join('\n');

    pageTexts.push(text);
  }

  return pageTexts.join('\n');
};

export default function TestEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const editorContextRef = useRef<EditorRequestContext>({
    testId: id,
    uid: user?.uid,
    generation: 0,
  });
  const editorMountedRef = useRef(false);
  
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [accessDenied, setAccessDenied] = useState(false);
  const [loadedOwnerId, setLoadedOwnerId] = useState<string | undefined>(undefined);
  const [loadedSlug, setLoadedSlug] = useState<string | undefined>(undefined);
  
  const [title, setTitle] = useState('');
  const [titleManuallyEdited, setTitleManuallyEdited] = useState(false);
  const [level, setLevel] = useState<TestLevel>('KS3');
  const [description, setDescription] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [curriculumText, setCurriculumText] = useState('');
  const [selectedChapter, setSelectedChapter] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [aiDrafts, setAiDrafts] = useState<Question[]>([]);
  const [genPrompt, setGenPrompt] = useState('');
  const [genCount, setGenCount] = useState(1);
  const [fullGenCount, setFullGenCount] = useState(10);
  const [generationStatus, setGenerationStatus] = useState('');
  const [expandedQs, setExpandedQs] = useState<Set<string>>(new Set());
  const showCurriculumSelector = level === '11+' || level === 'GCSE Foundation' || level === 'GCSE Higher';
  const curriculumChapters = useMemo(() => parseCurriculumChapters(curriculumText), [curriculumText]);
  const chapterOptions = useMemo(() => {
    const customChapters = curriculumChapters.filter(chapter => chapter !== OVERALL_REVISION);

    if (level === '11+') {
      return Array.from(new Set([
        ...DEFAULT_11_PLUS_CHAPTERS,
        ...customChapters,
      ]));
    }

    if (level === 'GCSE Higher') {
      return Array.from(new Set([
        ...DEFAULT_GCSE_HIGHER_CHAPTERS,
        ...customChapters,
      ]));
    }

    if (level === 'GCSE Foundation') {
      return Array.from(new Set([
        ...DEFAULT_GCSE_FOUNDATION_CHAPTERS,
        ...customChapters,
      ]));
    }

    return curriculumChapters;
  }, [curriculumChapters, level]);
  const curriculumHelperText = level === 'GCSE Foundation'
    ? 'Foundation topics are used for easier GCSE-style questions and foundation-tier skills.'
    : level === 'GCSE Higher'
      ? 'Higher topics are organised by paper and used for higher-tier GCSE-style questions.'
      : level === '11+'
        ? '11+ topics are based on the built-in maths curriculum, with overall revision available.'
        : '';
  const generationContext = [
    level === 'GCSE Foundation'
      ? 'This is GCSE Foundation tier. Keep the questions at Foundation level and avoid Higher-only content. The final questions should include two-step and three-step Foundation problem-solving so the test does not feel too easy.'
      : level === 'GCSE Higher'
        ? 'This is GCSE Higher tier. Generate Higher-level GCSE questions, including more demanding reasoning where appropriate.'
        : '',
    selectedChapter === OVERALL_REVISION
      ? `Generate an overall revision test across the ${level} curriculum.`
      : selectedChapter
        ? `Generate questions specifically from this curriculum chapter: ${selectedChapter}.`
        : '',
    aiPrompt,
  ].filter(Boolean).join('\n\n');

  useLayoutEffect(() => {
    if (editorContextRef.current.testId !== id || editorContextRef.current.uid !== user?.uid) {
      editorContextRef.current = {
        testId: id,
        uid: user?.uid,
        generation: editorContextRef.current.generation + 1,
      };
    }

    editorMountedRef.current = true;
    return () => {
      editorMountedRef.current = false;
    };
  }, [id, user?.uid]);

  const isCurrentEditorRequest = (requestContext: EditorRequestContext) =>
    editorMountedRef.current && isEditorRequestContextCurrent(requestContext, editorContextRef.current);

  useEffect(() => {
    if (!showCurriculumSelector) {
      setSelectedChapter('');
      return;
    }

    if (chapterOptions.length > 0 && !chapterOptions.includes(selectedChapter)) {
      setSelectedChapter(chapterOptions[0]);
    }
  }, [chapterOptions, selectedChapter, showCurriculumSelector]);

  useEffect(() => {
    if (id || titleManuallyEdited) return;

    const defaultTitle = buildDefaultTitle(level, selectedChapter);
    if (defaultTitle) {
      setTitle(defaultTitle);
    }
  }, [id, level, selectedChapter, titleManuallyEdited]);

  useEffect(() => {
    let ignore = false;

    async function loadTest() {
      setLoading(!!id);
      setSaving(false);
      setGenerating(false);
      setAccessDenied(false);
      setError('');
      setLoadedOwnerId(undefined);
      setLoadedSlug(undefined);
      setTitle('');
      setTitleManuallyEdited(false);
      setLevel('KS3');
      setDescription('');
      setAiPrompt('');
      setCurriculumText('');
      setSelectedChapter('');
      setQuestions([]);
      setAiDrafts([]);
      setGenPrompt('');
      setGenerationStatus('');
      setExpandedQs(new Set());

      if (!id) {
        setLoading(false);
        return;
      }

      if (authRequired === 'true' && !user?.uid) {
        setError('Authentication required.');
        setAccessDenied(true);
        setLoading(false);
        return;
      }

      try {
        const snap = await getDoc(doc(db, 'tests', id));
        if (ignore) return;

        if (snap.exists()) {
          const data = snap.data() as LegacyTest;
          if (shouldFilterByOwner(authRequired, user?.uid) && !belongsToTutor(data, user!.uid)) {
            setError('You do not have access to this test.');
            setAccessDenied(true);
            setLoading(false);
            return;
          }

          setTitle(data.title);
          setLevel(data.level);
          setDescription(data.description);
          setAiPrompt(data.aiPrompt || '');
          setQuestions(data.questions || []);
          setLoadedOwnerId(data.ownerId);
          setLoadedSlug(data.slug);
          setAccessDenied(false);
        } else {
          setError('Test not found');
        }
      } catch (err: any) {
        if (ignore) return;

        console.error(err);
        setError(err.message || 'Could not load test.');
        if (authRequired === 'true' && isPermissionLikeError(err)) {
          setAccessDenied(true);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadTest();

    return () => {
      ignore = true;
    };
  }, [id, user?.uid]);

  const handleGenerateFull = async () => {
    if (!level) return;
    const requestContext = editorContextRef.current;
    setGenerating(true);
    setError('');
    setGenerationStatus('');
    try {
      const batches = Math.ceil(fullGenCount / 5);
      const generated: Question[] = [];

      for (let batch = 0; batch < batches; batch += 1) {
        if (!isCurrentEditorRequest(requestContext)) return;

        const remaining = fullGenCount - generated.length;
        const batchSize = Math.min(5, remaining);
        const batchPrompt = [
          `Generate batch ${batch + 1} of ${batches} for a ${fullGenCount}-question diagnostic test.`,
          'Avoid repeating skills or question styles already likely covered in the previous batches.',
          generationContext,
        ].filter(Boolean).join('\n\n');

        setGenerationStatus(`Generating ${generated.length + batchSize} of ${fullGenCount}...`);
        const qs = await generateSpecificQuestions(level, batchPrompt, batchSize);
        if (!isCurrentEditorRequest(requestContext)) return;

        generated.push(...qs);
        setAiDrafts([...generated]);
        setExpandedQs(new Set([generated[0].id]));
      }
    } catch (err: any) {
      if (isCurrentEditorRequest(requestContext)) {
        setError(err.message || 'Error generating test');
      }
    } finally {
      if (isCurrentEditorRequest(requestContext)) {
        setGenerationStatus('');
        setGenerating(false);
      }
    }
  };

  const handleGenerateSpecific = async () => {
    if (!level || !genPrompt.trim()) return;
    const requestContext = editorContextRef.current;
    setGenerating(true);
    setError('');
    setGenerationStatus('');
    try {
      const description = selectedChapter && selectedChapter !== OVERALL_REVISION
        ? `${genPrompt}\n\nCurriculum chapter: ${selectedChapter}`
        : selectedChapter === OVERALL_REVISION
          ? `${genPrompt}\n\nCurriculum scope: overall ${level} revision`
        : genPrompt;
      const qs = await generateSpecificQuestions(level, description, genCount);
      if (!isCurrentEditorRequest(requestContext)) return;

      setAiDrafts(prev => [...prev, ...qs]);
      setExpandedQs(prev => new Set(prev).add(qs[0].id));
      setGenPrompt('');
    } catch (err: any) {
      if (isCurrentEditorRequest(requestContext)) {
        setError(err.message || 'Error generating questions');
      }
    } finally {
      if (isCurrentEditorRequest(requestContext)) {
        setGenerationStatus('');
        setGenerating(false);
      }
    }
  };

  const handleCurriculumUpload = async (file: File | undefined) => {
    if (!file) return;
    const requestContext = editorContextRef.current;

    try {
      const text = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
        ? await extractTextFromPdf(file)
        : await file.text();
      if (!isCurrentEditorRequest(requestContext)) return;

      setCurriculumText(text);
      const chapters = parseCurriculumChapters(text);
      setSelectedChapter(chapters[0] || '');
    } catch (err) {
      if (!isCurrentEditorRequest(requestContext)) return;

      console.error(err);
      setError('Could not read that curriculum file. Please try a text, CSV, Markdown, or selectable-text PDF file.');
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
    const slug = resolveTestSlug(title, user?.uid, id ? loadedSlug : undefined);
    
    if (authRequired === 'true' && !user?.uid) {
      setError('Authentication required.');
      return;
    }

    if (id && !canEditOwnedRecord(authRequired, loadedOwnerId, user?.uid)) {
      setError('You do not have access to save this test.');
      return;
    }

    if (!title.trim() || finalQuestions.length === 0) {
      setError('Title and at least 1 question are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const updatePayload: TestUpdatePayload = {
        title: title.trim(),
        level,
        slug,
        description,
        aiPrompt,
        questions: finalQuestions,
        updatedAt: Date.now(),
        isActive: true,
      };

      if (id) {
        await updateDoc(doc(db, 'tests', id), updatePayload);
      } else {
        const createPayload: TestCreatePayload = {
          ...updatePayload,
          ownerId: user?.uid || '',
          createdAt: Date.now(),
        };
        await addDoc(collection(db, 'tests'), createPayload);
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
      choices: ['', '', '', ''],
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
  if (accessDenied) return <div className="p-8">{error || 'You do not have access to this test.'}</div>;

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
                onChange={e => {
                  setTitle(e.target.value);
                  setTitleManuallyEdited(true);
                }}
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

            {showCurriculumSelector && (
              <div className="border-t border-slate-100 pt-4 space-y-3">
                {chapterOptions.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Test Chapter</label>
                    <select
                      value={selectedChapter}
                      onChange={e => setSelectedChapter(e.target.value)}
                      className="w-full border-slate-200 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 border p-2 bg-white text-sm"
                    >
                      {chapterOptions.map(chapter => <option key={chapter} value={chapter}>{chapter}</option>)}
                    </select>
                    {curriculumHelperText && (
                      <p className="text-xs text-slate-500 mt-1">{curriculumHelperText}</p>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Custom Curriculum Chapters</label>
                  <input
                    type="file"
                    accept=".txt,.md,.csv,.pdf,application/pdf"
                    onChange={e => handleCurriculumUpload(e.target.files?.[0])}
                    className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
                  />
                </div>

                <textarea
                  value={curriculumText}
                  onChange={e => {
                    setCurriculumText(e.target.value);
                    const chapters = parseCurriculumChapters(e.target.value);
                    if (!chapters.includes(selectedChapter)) {
                      setSelectedChapter(chapters[0] || '');
                    }
                  }}
                  rows={4}
                  className="w-full border-slate-200 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 border p-2 text-sm"
                  placeholder={level === '11+' ? 'Optional: paste extra 11+ chapters, one per line...' : 'Paste one chapter per line, e.g. Algebra, Fractions, Ratio and proportion...'}
                />
              </div>
            )}
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-3 text-blue-800">
              <Sparkles className="w-5 h-5" />
              <h2 className="font-bold text-lg">AI Generation</h2>
            </div>
            <div className="space-y-4">
              <div className="bg-white/60 p-4 rounded-xl border border-blue-100">
                <h3 className="text-sm font-bold text-blue-900 mb-2">Generate Diagnostic Test</h3>
                <p className="text-xs text-blue-700 mb-3 leading-relaxed">
                  Generate a {fullGenCount}-question diagnostic for {level} in reliable 5-question batches.
                </p>
                <div className="mb-4">
                  <label className="block text-xs font-bold text-blue-800 mb-1">Number of Questions</label>
                  <select
                    value={fullGenCount}
                    onChange={e => setFullGenCount(Number(e.target.value))}
                    className="w-full border-blue-200 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 border p-2 text-sm bg-white"
                  >
                    {[10, 15, 20].map(n => <option key={n} value={n}>{n} Questions</option>)}
                  </select>
                </div>
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
                  {generating ? generationStatus || 'Generating...' : 'Generate Test'}
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
