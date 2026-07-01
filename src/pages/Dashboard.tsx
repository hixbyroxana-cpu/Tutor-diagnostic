import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Copy, Edit } from 'lucide-react';
import { db, collection, getDocs, query, orderBy, limit, where } from '../firebase';
import { useAuth } from '../auth/AuthProvider';
import { LegacyTest, LegacyTestResult } from '../types';
import { getPublicAppBaseUrl, shouldFilterByOwner } from '../lib/tutor-query';
import { cn, getLevelColor } from '../lib/utils';

const authRequired = import.meta.env.VITE_AUTH_REQUIRED;

export default function Dashboard() {
  const { user } = useAuth();
  const [tests, setTests] = useState<LegacyTest[]>([]);
  const [results, setResults] = useState<LegacyTestResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    async function loadData() {
      setLoading(true);
      setTests([]);
      setResults([]);

      try {
        const filterByOwner = shouldFilterByOwner(authRequired, user?.uid);
        const testsQ = filterByOwner
          ? query(collection(db, 'tests'), where('ownerId', '==', user!.uid), orderBy('createdAt', 'desc'), limit(5))
          : query(collection(db, 'tests'), orderBy('createdAt', 'desc'), limit(5));
        const testsSnap = await getDocs(testsQ);
        const testsData = testsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LegacyTest));

        const resQ = filterByOwner
          ? query(collection(db, 'testResults'), where('ownerId', '==', user!.uid), orderBy('completedAt', 'desc'), limit(10))
          : query(collection(db, 'testResults'), orderBy('completedAt', 'desc'), limit(10));
        const resSnap = await getDocs(resQ);
        const resData = resSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LegacyTestResult));

        if (ignore) return;
        setTests(testsData);
        setResults(resData);
      } catch (err) {
        if (ignore) return;
        console.error("Failed to load dashboard data", err);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    loadData();

    return () => {
      ignore = true;
    };
  }, [user?.uid]);

  const copyLink = (slug: string) => {
    const baseUrl = getPublicAppBaseUrl(import.meta.env.VITE_PUBLIC_APP_URL, window.location.origin);
    const url = `${baseUrl}/test/${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  if (loading) return <div className="animate-pulse">Loading dashboard...</div>;

  return (
    <div className="space-y-8">
      {/* We can hide the old big dashboard header if we want, but it's okay to keep or adapt */}
      <div className="hidden lg:block">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard</h1>
        <p className="text-slate-500 mt-1">Overview of your tests and recent results.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT COLUMN: Test Management */}
        <section className="col-span-1 lg:col-span-7 flex flex-col gap-6">
          <div className="flex justify-between items-end shrink-0">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Diagnostic Tests</h2>
              <p className="text-slate-500 text-sm">Share permanent links with new students</p>
            </div>
            <Link to="/tests/new" className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
              <span>+ Create New</span>
            </Link>
          </div>

          <div className="flex gap-3 shrink-0">
            <Link to="/tests/new" className="flex-1 bg-blue-50 border border-blue-200 text-blue-700 py-3 px-4 rounded-xl flex flex-col gap-1 hover:bg-blue-100 transition-colors text-left">
              <span className="text-xs font-bold uppercase tracking-wider opacity-70">Gemini Assistant</span>
              <span className="text-sm font-semibold">Generate 20-Question Test</span>
            </Link>
            <Link to="/tests/new" className="flex-1 bg-white border border-slate-200 text-slate-700 py-3 px-4 rounded-xl flex flex-col gap-1 hover:bg-slate-50 transition-colors text-left">
              <span className="text-xs font-bold uppercase tracking-wider opacity-70">Manual Entry</span>
              <span className="text-sm font-semibold">Draft Test Content</span>
            </Link>
          </div>

          {/* Active Links Grid */}
          <div className="grid grid-cols-1 gap-4 overflow-y-auto pr-2 pb-4">
            {tests.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500 text-sm">
                No tests created yet.
              </div>
            ) : (
              tests.map(test => (
                <div key={test.id} className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm flex items-center justify-between">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn("text-xs font-bold px-2 py-0.5 rounded", getLevelColor(test.level))}>
                        {test.level.toUpperCase()}
                      </span>
                      <span className="text-sm font-semibold text-slate-800 uppercase tracking-tighter w-24 sm:w-auto truncate">
                        /test/{test.slug}
                      </span>
                    </div>
                    <h3 className="font-medium text-slate-700">{test.title}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link to={`/tests/${test.id}/edit`} className="bg-slate-100 hover:bg-slate-200 text-slate-600 p-2 rounded-md transition-all border border-slate-200" title="Edit Test">
                      <Edit className="w-4 h-4" />
                    </Link>
                    <button 
                      onClick={() => copyLink(test.slug)}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-600 p-2 rounded-md flex items-center gap-2 text-xs font-bold transition-all border border-slate-200 group"
                    >
                      {copiedSlug === test.slug ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                      <span className="hidden sm:inline">COPY LINK</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* RIGHT COLUMN: Recent Results */}
        <section className="col-span-1 lg:col-span-5 bg-white border border-slate-200 rounded-2xl flex flex-col overflow-hidden shadow-xl max-h-[800px]">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
            <h2 className="font-bold text-slate-800 flex items-center gap-2">
              Recent Results
              {results.length > 0 && <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">{results.length}</span>}
            </h2>
            <Link to="/results" className="text-xs font-bold text-blue-600 hover:underline">
              View All
            </Link>
          </div>
          
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {results.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">
                No results recorded yet.
              </div>
            ) : (
              results.map(res => {
                const initials = res.studentFullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                return (
                  <Link key={res.id} to={`/results/${res.id}`} className="block p-6 hover:bg-blue-50/30 transition-colors cursor-pointer group relative">
                    <div className="absolute right-6 top-6">
                      <div className="text-right">
                        <div className="text-lg font-bold text-slate-900">{res.score}/{res.totalQuestions}</div>
                        <div className={cn("text-[10px] font-bold uppercase tracking-widest", res.percentage >= 80 ? "text-green-600" : res.percentage >= 60 ? "text-amber-600" : "text-red-600")}>
                          Score: {res.percentage}%
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold shrink-0">
                        {initials}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 group-hover:text-blue-700 transition-colors w-32 sm:w-48 truncate">{res.studentFullName}</h4>
                        <p className="text-xs text-slate-500">{new Date(res.completedAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded font-medium border border-slate-200">
                        {res.testLevel}
                      </span>
                      {res.weakTopics.length > 0 && <span className="text-[10px] px-2 py-0.5 bg-red-50 text-red-700 border border-red-100 rounded font-medium max-w-[150px] truncate">
                        Weak: {res.weakTopics[0]}
                      </span>}
                    </div>
                  </Link>
                );
              })
            )}
          </div>

          {/* Summary Stats Footer */}
          <div className="bg-slate-900 p-4 text-white shrink-0">
            <div className="flex justify-between items-center">
              <div className="flex gap-4">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Tests</div>
                  <div className="text-lg font-bold">{tests.length}</div>
                </div>
                <div className="border-l border-slate-700 pl-4">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Results</div>
                  <div className="text-lg font-bold">{results.length}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Avg Score</div>
                <div className="text-lg font-bold">
                  {results.length > 0 ? Math.round(results.reduce((acc, r) => acc + r.percentage, 0) / results.length) : 0}%
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
