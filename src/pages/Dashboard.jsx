import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AdminDashboard from './Admin/AdminDashboard';
import SellerDashboard from './Seller/SellerDashboard';
import { Loader } from '../components/ui/Loader';

const Dashboard = () => {
  const { profile, loading } = useAuth();

  // 1. Aguarda carregar o perfil para não dar erro
  if (loading || !profile) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50">
         <Loader size={40} className="text-indigo-600" />
      </div>
    );
  }

  // 2. O Guarda de Trânsito: Direciona cada cargo para a sua tela correta
  if (profile.role === 'admin') {
      return <AdminDashboard />;
  } 
  
  if (profile.role === 'balcao') {
      // Se for balcão, a gente chuta ele direto pra rota do PDV que criamos no App.jsx!
      return <Navigate to="/pdv" replace />;
  }

  // 3. Fallback: Se for 'vendedor' (ou qualquer outra coisa que sobrar), vai pro painel de rua
  return <SellerDashboard />;
};

export default Dashboard;