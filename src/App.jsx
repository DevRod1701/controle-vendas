import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataContext';
import { Loader } from './components/ui/Loader';
import Layout from './components/Layout';

// Páginas Comuns
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Catalog from './pages/Catalog';
import History from './pages/History';

// Páginas do Vendedor
import Customers from './pages/Seller/Customers';
import CustomerDetail from './pages/Seller/CustomerDetail';

// Páginas Admin
import Stock from './pages/Admin/Stock';
import Team from './pages/Admin/Team';
import Approvals from './pages/Admin/Approvals';
import NewSeller from './pages/Admin/NewSeller';
import Reports from './pages/Admin/Reports';
import RetroImport from './pages/Admin/RetroImport';

// NOVO: Importação do PDV (Balcão)
import BalcaoPOS from './pages/BalcaoPOS'; // Ajuste o caminho se você salvou em outra pasta (ex: './pages/Admin/BalcaoPOS')

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

      {/* 🚀 O SEGREDO: A rota do PDV fica FORA do Layout para ocupar a tela toda no Desktop! */}
      <Route path="/pdv" element={
        <PrivateRoute>
          <BalcaoPOS />
        </PrivateRoute>
      } />

      {/* O restante do app fica protegido e dentro do Layout de Celular */}
      <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/catalogo" element={<Catalog />} />
        <Route path="/historico" element={<History />} />
        
        {/* Vendedor */}
        <Route path="/clientes" element={<Customers />} />
        <Route path="/clientes/:id" element={<CustomerDetail />} />
        
        {/* Admin */}
        <Route path="/estoque" element={<Stock />} />
        <Route path="/equipe" element={<Team />} />
        <Route path="/aprovacoes" element={<Approvals />} />
        <Route path="/novo-vendedor" element={<NewSeller />} />
        <Route path="/relatorios" element={<Reports />} />
        <Route path="/importar" element={<RetroImport />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const App = () => {
  return (
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