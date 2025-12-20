import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, UserPlus, TrendingUp, Settings, Wallet } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabase';
import { formatBRL } from '../../utils/formatters';
import AlertModal from '../../components/modals/AlertModal';
import SecurityModal from '../../components/modals/SecurityModal';

const Team = () => {
  const { orders, refreshData } = useData();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  
  const [alertInfo, setAlertInfo] = useState(null);
  const [sellerToDelete, setSellerToDelete] = useState(null);
  const [profiles, setProfiles] = useState([]);

  // Busca a lista oficial de vendedores na tabela profiles
  useEffect(() => {
    const fetchProfiles = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'vendedor'); // Busca correta: 'vendedor' em pt-br
      
      if (data) setProfiles(data);
    };

    fetchProfiles();
  }, [orders]);

  // Combina a lista de perfis com as vendas
  const sellers = useMemo(() => {
    const sellerMap = {};
    
    // 1. Inicializa com os perfis cadastrados
    profiles.forEach(p => {
        sellerMap[p.id] = {
            id: p.id,
            // Garante que pega full_name. Se falhar, tenta name ou 'Sem Nome'
            name: p.full_name || p.name || 'Sem Nome',
            sales: 0,
            commission: 0,
            lastSale: null
        };
    });

    // 2. Preenche com os dados dos pedidos
    orders.forEach(o => {
      // Se tiver pedido de alguém antigo que não está em profiles, adiciona
      if (!sellerMap[o.seller_id]) {
        sellerMap[o.seller_id] = { 
            id: o.seller_id, 
            name: o.seller_name, 
            sales: 0, 
            commission: 0, 
            lastSale: null
        };
      }

      // Soma vendas aprovadas
      if (o.type === 'sale' && o.status === 'approved') {
        sellerMap[o.seller_id].sales += Number(o.total || 0);
        sellerMap[o.seller_id].commission += Number(o.total || 0) * 0.20;
      }

      // Atualiza data da última venda
      if (!sellerMap[o.seller_id].lastSale || new Date(o.created_at) > new Date(sellerMap[o.seller_id].lastSale)) {
          sellerMap[o.seller_id].lastSale = o.created_at;
      }
    });

    return Object.values(sellerMap);
  }, [orders, profiles]);

  const requestDeleteSeller = (seller) => {
    setSellerToDelete(seller);
  };

  const confirmDeleteSeller = async () => {
    if (!sellerToDelete) return;
    const idToDelete = sellerToDelete.id;
    setSellerToDelete(null); 

    try {
        const { error: rpcError } = await supabase.rpc('delete_user_account', { 
            user_id: idToDelete 
        });

        if (rpcError) throw rpcError;

        setAlertInfo({ type: 'success', title: 'Excluído', message: 'Vendedor removido com segurança.' });
        
        // Atualiza a lista local removendo o excluído
        setProfiles(prev => prev.filter(p => p.id !== idToDelete));
        
        setTimeout(() => {
            setAlertInfo(null);
            refreshData();
        }, 1500);

    } catch (error) {
        console.error("Erro ao excluir:", error);
        setAlertInfo({ type: 'error', title: 'Erro', message: error.message || 'Falha ao excluir usuário.' });
    }
  };

  return (
    <div className="p-6 pb-24 space-y-6 animate-in fade-in font-bold">
      <AlertModal isOpen={!!alertInfo} type={alertInfo?.type} title={alertInfo?.title} message={alertInfo?.message} onClose={() => setAlertInfo(null)} />
      
      <SecurityModal 
        isOpen={!!sellerToDelete} 
        sellerName={sellerToDelete?.name} 
        onCancel={() => setSellerToDelete(null)} 
        onConfirm={confirmDeleteSeller} 
      />

      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/')} className="p-3 bg-white rounded-2xl shadow-sm"><ArrowLeft size={20}/></button>
        <h2 className="text-xl font-black text-slate-800 uppercase">Equipe</h2>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-indigo-600 text-white p-5 rounded-[2.5rem] shadow-lg">
            <p className="text-[10px] uppercase font-black tracking-widest opacity-80">Vendedores</p>
            <p className="text-3xl font-black font-mono">{sellers.length}</p>
        </div>
        <button onClick={() => navigate('/novo-vendedor')} className="bg-white p-5 rounded-[2.5rem] shadow-sm border-2 border-slate-50 flex flex-col justify-center items-center gap-2 active:scale-95 transition-all">
            <div className="p-2 bg-yellow-400 rounded-full text-slate-900"><UserPlus size={20}/></div>
            <p className="text-xs font-black uppercase text-slate-800">Novo</p>
        </button>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-black text-slate-800 uppercase ml-2">Lista de Vendedores</h3>
        {sellers.map(s => (
            <div key={s.id} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-50 relative">
                <div className="flex justify-between items-start mb-4">
                    <button onClick={() => navigate('/historico', { state: { sellerId: s.id, sellerName: s.name } })} className="text-left w-full">
                        <p className="text-lg font-black text-slate-800 uppercase">{s.name}</p>
                        <p className="text-[10px] text-slate-400 font-bold">
                            {s.lastSale 
                                ? `Última venda: ${new Date(s.lastSale).toLocaleDateString()}` 
                                : "Nenhuma venda registrada"}
                        </p>
                    </button>
                    
                    <button 
                        onClick={() => requestDeleteSeller(s)} 
                        className="p-2 bg-slate-50 text-slate-300 hover:text-red-400 hover:bg-red-50 rounded-xl transition-all absolute right-6 top-6"
                        title="Gerenciar Vendedor"
                    >
                        <Settings size={20}/>
                    </button>
                </div>
                
                <div className="flex gap-3">
                    <div className="flex-1 bg-green-50 p-3 rounded-2xl">
                        <p className="text-[9px] text-green-600 font-black uppercase flex items-center gap-1"><TrendingUp size={10}/> Vendas</p>
                        <p className="text-lg font-black text-green-700 font-mono">{formatBRL(s.sales)}</p>
                    </div>
                    <div className="flex-1 bg-indigo-50 p-3 rounded-2xl">
                        <p className="text-[9px] text-indigo-500 font-black uppercase flex items-center gap-1"><Wallet size={10}/> Comissão</p>
                        <p className="text-lg font-black text-indigo-600 font-mono">{formatBRL(s.commission)}</p>
                    </div>
                </div>
            </div>
        ))}
        {sellers.length === 0 && <p className="text-center text-slate-400 text-xs py-10">Nenhum vendedor encontrado.</p>}
      </div>
    </div>
  );
};

export default Team;