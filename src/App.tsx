/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AdminLayout } from './components/AdminLayout';

import Dashboard from './pages/Dashboard';
import TestsList from './pages/TestsList';
import TestEditor from './pages/TestEditor';
import ResultsList from './pages/ResultsList';
import ResultDetail from './pages/ResultDetail';
import PublicTestRunner from './pages/PublicTestRunner';

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
        <Route path="/test/:slug" element={<PublicTestRunner />} />
      </Routes>
    </BrowserRouter>
  );
}

