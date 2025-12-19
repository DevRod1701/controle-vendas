import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import AdminDashboard from './Admin/AdminDashboard';
import SellerDashboard from './Seller/SellerDashboard';

const Dashboard = () => {
  const { isAdmin } = useAuth();

  // Se for admin, carrega o painel Admin, senão o de Vendedor
  return isAdmin ? <AdminDashboard /> : <SellerDashboard />;
};

export default Dashboard;