import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useData } from '../../contexts/DataContext';
import { formatBRL } from '../../utils/formatters';

const Team = () => {
  const { orders } = useData();
  const navigate = useNavigate();
  const [sellers, setSellers] = useState([]);

  useEffect(() => {
    supabase.from('profiles').select('*').eq('role', 'vendedor').then(({data}) => data && setSellers(data));
  }, []);

  const getSellerDebt = (sellerId) => {
    return orders.filter(o => o.seller_id === sellerId).reduce((acc, o) => {
      if (o.type === 'sale' && o.status === 'approved') return acc + (Number(o.total) - Number(o.paid || 0));
      return acc;
    }, 0);
  };

  // Esta função envia o Admin para o histórico filtrado pelo ID do vendedor
  const handleViewHistory = (seller) => {
    navigate('/historico', { 
      state: { 
        sellerId: seller.id, 
        sellerName: seller.full_name 
      } 
    });
  };

  return (
    <div className="p-6 pb-24 space-y-6 animate-in fade-in font-bold">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/')} className="p-3 bg-white rounded-2xl shadow-sm"><ArrowLeft size={20}/></button>
        <h2 className="text-xl font-black text-slate-800 uppercase">Equipe</h2>
      </div>
      <div className="space-y-4">
        {sellers.map(s => (
          <button 
            key={s.id} 
            onClick={() => handleViewHistory(s)}
            className="w-full bg-white p-6 rounded-[2.5rem] shadow-sm flex items-center justify-between border border-slate-50 text-left active:scale-95 transition-all"
          >
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center font-black">{s.full_name?.charAt(0)}</div>
                <div><p className="font-black text-slate-800">{s.full_name}</p><p className="text-[10px] text-slate-400 uppercase font-bold">Ver Histórico</p></div>
            </div>
            <div className="text-right"><p className="text-[9px] font-black text-slate-400 uppercase">Dívida</p><p className="font-black text-red-500 font-mono">{formatBRL(getSellerDebt(s.id))}</p></div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default Team;