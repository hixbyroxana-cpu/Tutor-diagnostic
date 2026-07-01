import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Plus, Copy, Check, Edit, Trash2 } from 'lucide-react';
import { db, collection, deleteDoc, doc, getDocs, query, orderBy, where } from '../firebase';
import { useAuth } from '../auth/AuthProvider';
import { LegacyTest } from '../types';
import { belongsToTutor } from '../lib/ownership';
import { deleteTestDocument, removeTestById } from '../lib/test-deletion';
import { getPublicAppBaseUrl, shouldFilterByOwner } from '../lib/tutor-query';
import { cn, getLevelColor } from '../lib/utils';

const authRequired = import.meta.env.VITE_AUTH_REQUIRED;

export default function TestsList() {
  const { user } = useAuth();
  const [tests, setTests] = useState<LegacyTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [testPendingDeletion, setTestPendingDeletion] = useState<LegacyTest | null>(null);
  const [deletingTestId, setDeletingTestId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    let ignore = false;

    async function fetchTests() {
      setLoading(true);
      setTests([]);

      try {
        const q = shouldFilterByOwner(authRequired, user?.uid)
          ? query(collection(db, 'tests'), where('ownerId', '==', user!.uid), orderBy('createdAt', 'desc'))
          : query(collection(db, 'tests'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        if (ignore) return;
        setTests(snap.docs.map(d => ({ id: d.id, ...d.data() } as LegacyTest)));
      } catch (err) {
        if (ignore) return;
        console.error(err);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    fetchTests();

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

  async function confirmDelete() {
    const testId = testPendingDeletion?.id;
    if (!testPendingDeletion || !testId || !user?.uid || !belongsToTutor(testPendingDeletion, user.uid)) {
      setDeleteError('You can only delete tests owned by your account.');
      return;
    }

    setDeletingTestId(testId);
    setDeleteError('');

    try {
      await deleteTestDocument(testId, async selectedId => {
        await deleteDoc(doc(db, 'tests', selectedId));
      });
      setTests(current => removeTestById(current, testId));
      setTestPendingDeletion(null);
    } catch (error) {
      console.error('Failed to delete test', error);
      setDeleteError('The test could not be deleted. Please try again.');
    } finally {
      setDeletingTestId(null);
    }
  }

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
                      {test.id && user?.uid && belongsToTutor(test, user.uid) && (
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteError('');
                            setTestPendingDeletion(test);
                          }}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition"
                          aria-label={`Delete ${test.title}`}
                          title="Delete Test"
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {testPendingDeletion && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
          role="presentation"
          onMouseDown={event => {
            if (event.currentTarget === event.target && !deletingTestId) {
              setTestPendingDeletion(null);
              setDeleteError('');
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-test-heading"
            className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-xl"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
              <div>
                <h2 id="delete-test-heading" className="text-lg font-bold text-slate-900">
                  Delete {testPendingDeletion.title}?
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  Its student link will stop working. Completed results and reports will remain available.
                  This cannot be undone.
                </p>
              </div>
            </div>

            {deleteError && (
              <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                {deleteError}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={Boolean(deletingTestId)}
                onClick={() => {
                  setTestPendingDeletion(null);
                  setDeleteError('');
                }}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={Boolean(deletingTestId)}
                onClick={() => void confirmDelete()}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deletingTestId ? 'Deleting...' : 'Delete test'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
