import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataContext';
import { Loader } from './components/ui/Loader';
import Layout from './components/Layout';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Catalog from './pages/Catalog';
import History from './pages/History';

import Stock from './pages/Admin/Stock';
import Team from './pages/Admin/Team';
import Approvals from './pages/Admin/Approvals';
import NewSeller from './pages/Admin/NewSeller';

const PrivateRoute = ({ children }) => {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-yellow-400">
        <Loader size={40} className="text-white" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/catalogo" element={<Catalog />} />
        <Route path="/historico" element={<History />} />
        <Route path="/estoque" element={<Stock />} />
        <Route path="/equipe" element={<Team />} />
        <Route path="/aprovacoes" element={<Approvals />} />
        <Route path="/novo-vendedor" element={<NewSeller />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const App = () => {
  return (
    // Adicionamos estas flags para remover os warnings do console
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <DataProvider>
          <AppRoutes />
        </DataProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;