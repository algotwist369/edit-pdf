import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell.jsx';
import { AuthProvider, useAuth } from './state/auth.jsx';
import { BatchHistory } from './pages/BatchHistory.jsx';
import { CreateBatch } from './pages/CreateBatch.jsx';
import { Dashboard } from './pages/Dashboard.jsx';
import { LoginRegister } from './pages/LoginRegister.jsx';
import { ProcessBatch } from './pages/ProcessBatch.jsx';
import './styles.css';

const PrivateRoute = ({ children }) => {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" replace />;
};

const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<LoginRegister />} />
    <Route
      path="/"
      element={
        <PrivateRoute>
          <AppShell />
        </PrivateRoute>
      }
    >
      <Route index element={<Dashboard />} />
      <Route path="batches/new" element={<CreateBatch />} />
      <Route path="batches/:batchId/process" element={<ProcessBatch />} />
      <Route path="history" element={<BatchHistory />} />
    </Route>
  </Routes>
);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
);
