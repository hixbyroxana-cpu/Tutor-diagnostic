import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Filter, Eye } from 'lucide-react';
import { db, collection, getDocs, query, orderBy } from '../firebase';
import { TestResult } from '../types';

export default function ResultsList() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterLevel, setFilterLevel] = useState<string>('All');
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function fetchResults() {
      try {
        const q = query(collection(db, 'testResults'), orderBy('completedAt', 'desc'));
        const snap = await getDocs(q);
        setResults(snap.docs.map(d => ({ id: d.id, ...d.data() } as TestResult)));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchResults();
  }, []);

  const levels = ['All', ...Array.from(new Set(results.map(r => r.testLevel)))];

  const filtered = results.filter(r => {
    if (filterLevel !== 'All' && r.testLevel !== filterLevel) return false;
    if (search && !r.studentFullName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (loading) return <div className="animate-pulse">Loading results...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Results</h1>
          <p className="text-slate-500 mt-1">Review student diagnostic test results.</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search students..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
        <div className="relative sm:w-64">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <select 
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg appearance-none focus:ring-2 focus:ring-blue-500 outline-none bg-white"
          >
            {levels.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
            <tr>
              <th className="px-6 py-4">Student</th>
              <th className="px-6 py-4">Test</th>
              <th className="px-6 py-4">Score</th>
              <th className="px-6 py-4">Date</th>
              <th className="px-6 py-4 text-right">View</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                  No results found.
                </td>
              </tr>
            ) : (
              filtered.map(res => (
                <tr key={res.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{res.studentFullName}</div>
                    <div className="text-xs text-slate-500">{res.parentEmail}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-slate-900">{res.testTitle}</div>
                    <div className="text-xs text-slate-500">{res.testLevel}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className={`font-bold ${res.percentage >= 80 ? 'text-green-600' : res.percentage >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                        {res.percentage}%
                      </div>
                      <div className="text-slate-400 text-xs text-center border-l pl-2">
                        {res.score}/{res.totalQuestions}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-500">
                    {new Date(res.completedAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link 
                      to={`/results/${res.id}`}
                      className="inline-flex items-center justify-center p-2 text-blue-600 hover:bg-blue-50 rounded-md transition"
                    >
                      <Eye className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
