import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Copy, Check, Edit } from 'lucide-react';
import { db, collection, getDocs, query, orderBy, where } from '../firebase';
import { useAuth } from '../auth/AuthProvider';
import { LegacyTest } from '../types';
import { getPublicAppBaseUrl, shouldFilterByOwner } from '../lib/tutor-query';
import { cn, getLevelColor } from '../lib/utils';

const authRequired = import.meta.env.VITE_AUTH_REQUIRED;

export default function TestsList() {
  const { user } = useAuth();
  const [tests, setTests] = useState<LegacyTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTests() {
      try {
        const q = shouldFilterByOwner(authRequired, user?.uid)
          ? query(collection(db, 'tests'), where('ownerId', '==', user!.uid), orderBy('createdAt', 'desc'))
          : query(collection(db, 'tests'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        setTests(snap.docs.map(d => ({ id: d.id, ...d.data() } as LegacyTest)));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchTests();
  }, [user?.uid]);

  const copyLink = (slug: string) => {
    const baseUrl = getPublicAppBaseUrl(import.meta.env.VITE_PUBLIC_APP_URL, window.location.origin);
    const url = `${baseUrl}/test/${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  if (loading) return <div className="animate-pulse">Loading tests...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Diagnostic Tests</h1>
          <p className="text-slate-500 mt-1">Manage your active diagnostic tests.</p>
        </div>
        <Link 
          to="/tests/new" 
          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Test
        </Link>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
            <tr>
              <th className="px-6 py-4">Title</th>
              <th className="px-6 py-4">Level</th>
              <th className="px-6 py-4">Questions</th>
              <th className="px-6 py-4">Created</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tests.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                  No tests found. Click "Create Test" to get started.
                </td>
              </tr>
            ) : (
              tests.map(test => (
                <tr key={test.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{test.title}</div>
                    <div className="text-xs text-slate-500">/test/{test.slug}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn("inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border border-transparent", getLevelColor(test.level))}>
                      {test.level}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-600">{test.questions.length}</td>
                  <td className="px-6 py-4 text-slate-500">
                    {new Date(test.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => copyLink(test.slug)}
                        className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition"
                        title="Copy Public Link"
                      >
                        {copiedSlug === test.slug ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                      </button>
                      <Link 
                        to={`/tests/${test.id}/edit`}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition"
                        title="Edit Test"
                      >
                        <Edit className="w-4 h-4" />
                      </Link>
                    </div>
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
