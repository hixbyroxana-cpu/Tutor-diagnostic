/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { AdminLayout } from './components/AdminLayout';

import Dashboard from './pages/Dashboard';
import TestsList from './pages/TestsList';
import TestEditor from './pages/TestEditor';
import ResultsList from './pages/ResultsList';
import ResultDetail from './pages/ResultDetail';
import PublicTestRunner from './pages/PublicTestRunner';

function MissingTestSlug() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-8 text-center max-w-md">
        <h1 className="text-2xl font-bold text-slate-900 mb-3">Test link incomplete</h1>
        <p className="text-slate-600 mb-6">
          Student test links need a test name after `/test/`. Open the Tests page and copy a full public link.
        </p>
        <Link
          to="/tests"
          className="inline-flex items-center justify-center bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition"
        >
          Go to Tests
        </Link>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Admin Routes */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route element={<AdminLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/tests" element={<TestsList />} />
          <Route path="/tests/new" element={<TestEditor />} />
          <Route path="/tests/:id/edit" element={<TestEditor />} />
          <Route path="/results" element={<ResultsList />} />
          <Route path="/results/:id" element={<ResultDetail />} />
        </Route>

        {/* Public Routes */}
        <Route path="/test" element={<MissingTestSlug />} />
        <Route path="/test/" element={<MissingTestSlug />} />
        <Route path="/test/:slug" element={<PublicTestRunner />} />
      </Routes>
    </BrowserRouter>
  );
}
