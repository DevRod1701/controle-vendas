import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, UserPlus, TrendingUp, Settings, Wallet, Calculator, ChevronLeft, ChevronRight, Calendar, CheckCircle2 } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabase';
import { formatBRL } from '../../utils/formatters';
import AlertModal from '../../components/modals/AlertModal';
import SecurityModal from '../../components/modals/SecurityModal';
import CommissionModal from '../../components/modals/CommissionModal';

const Team = () => {
  const { orders, payments, refreshData } = useData();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  
  const [alertInfo, setAlertInfo] = useState(null);
  const [sellerToDelete, setSellerToDelete] = useState(null);
  const [sellerToCalculate, setSellerToCalculate] = useState(null);
  
  const [profiles, setProfiles] = useState([]);

  // Estado para controle do mês selecionado (Padrão: Hoje)
  const [selectedDate, setSelectedDate] = useState(new Date());

  const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  const fetchProfiles = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('role', 'vendedor');
    if (data) setProfiles(data);
  };

  useEffect(() => {
    fetchProfiles();
  }, [orders]);

  // Funções de navegação de data
  const prevMonth = () => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(selectedDate.getMonth() - 1);
    setSelectedDate(newDate);
  };

  const nextMonth = () => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(selectedDate.getMonth() + 1);
    setSelectedDate(newDate);
  };

  // Helper para verificar se uma data pertence ao mês selecionado
  const isInSelectedMonth = (dateString) => {
    if (!dateString) return false;
    const d = new Date(dateString);
    const dAdjusted = new Date(d.getTime() + d.getTimezoneOffset() * 60000);
    return dAdjusted.getMonth() === selectedDate.getMonth() && dAdjusted.getFullYear() === selectedDate.getFullYear();
  };

  const sellers = useMemo(() => {
    const sellerMap = {};
    
    // 1. Inicializa vendedores
    profiles.forEach(p => {
        sellerMap[p.id] = {
            id: p.id,
            name: p.full_name || p.name || 'Sem Nome',
            commissionRate: p.commission_rate || 20,
            sales: 0,
            paidReal: 0, 
            consumed: 0, 
            lastSale: null 
        };
    });

    // 2. Processa Pedidos (Vendas do Mês)
    orders.forEach(o => {
      if (!sellerMap[o.seller_id]) {
        sellerMap[o.seller_id] = { id: o.seller_id, name: o.seller_name, commissionRate: 20, sales: 0, paidReal: 0, consumed: 0, lastSale: null };
      }

      // Atualiza última venda (independente do mês, para saber atividade)
      if (!sellerMap[o.seller_id].lastSale || new Date(o.created_at) > new Date(sellerMap[o.seller_id].lastSale)) {
          sellerMap[o.seller_id].lastSale = o.created_at;
      }

      // Soma vendas SE for do mês selecionado
      if (o.type === 'sale' && o.status === 'approved' && isInSelectedMonth(o.created_at)) {
        sellerMap[o.seller_id].sales += Number(o.total || 0);
      }
    });
    
    // 3. Processa Pagamentos (LÓGICA ATUALIZADA: POR COMPETÊNCIA)
    payments.forEach(p => {
        const order = orders.find(o => o.id === p.order_id);
        
        // AQUI ESTÁ A MUDANÇA:
        // Usamos a data do PEDIDO (order.created_at) como referência para saber o mês.
        // Se não achar o pedido (o que não deve acontecer), usa a data do pagamento.
        const referenceDate = order ? order.created_at : p.date;

        if (isInSelectedMonth(referenceDate)) {
            if (order && sellerMap[order.seller_id]) {
                if (p.method === 'Consumo') {
                    sellerMap[order.seller_id].consumed += Number(p.amount);
                } else {
                    sellerMap[order.seller_id].paidReal += Number(p.amount);
                }
            }
        }
    });

    return Object.values(sellerMap);
  }, [orders, profiles, payments, selectedDate]);

  const requestDeleteSeller = (seller) => {
    setSellerToDelete(seller);
  };

  const confirmDeleteSeller = async () => {
    if (!sellerToDelete) return;
    const idToDelete = sellerToDelete.id;
    setSellerToDelete(null); 

    try {
        const { error: rpcError } = await supabase.rpc('delete_user_account', { user_id: idToDelete });
        if (rpcError) throw rpcError;
        setAlertInfo({ type: 'success', title: 'Excluído', message: 'Vendedor removido com segurança.' });
        setProfiles(prev => prev.filter(p => p.id !== idToDelete));
        setTimeout(() => { setAlertInfo(null); refreshData(); }, 1500);
    } catch (error) {
        setAlertInfo({ type: 'error', title: 'Erro', message: error.message || 'Falha ao excluir usuário.' });
    }
  };

  return (
    <div className="p-6 pb-24 space-y-6 animate-in fade-in font-bold">
      <AlertModal isOpen={!!alertInfo} type={alertInfo?.type} title={alertInfo?.title} message={alertInfo?.message} onClose={() => setAlertInfo(null)} />
      
      <SecurityModal isOpen={!!sellerToDelete} sellerName={sellerToDelete?.name} onCancel={() => setSellerToDelete(null)} onConfirm={confirmDeleteSeller} />

      {sellerToCalculate && (
          <CommissionModal 
            seller={sellerToCalculate} 
            orders={orders} 
            payments={payments} 
            selectedDate={selectedDate} // Passa o mês selecionado para o modal também
            onClose={() => {
                setSellerToCalculate(null);
                fetchProfiles();
            }} 
          />
      )}

      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/')} className="p-3 bg-white rounded-2xl shadow-sm"><ArrowLeft size={20}/></button>
        <h2 className="text-xl font-black text-slate-800 uppercase">Equipe</h2>
      </div>

      {/* Navegador de Meses */}
      <div className="bg-white p-2 rounded-[1.5rem] border border-slate-100 shadow-sm flex items-center justify-between">
          <button onClick={prevMonth} className="p-3 bg-slate-50 rounded-xl active:scale-90"><ChevronLeft size={20}/></button>
          <div className="text-center">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Referência</p>
            <p className="text-lg font-black text-slate-800 uppercase flex items-center justify-center gap-2">
                <Calendar size={18} className="text-indigo-500"/> 
                {months[selectedDate.getMonth()]} <span className="text-slate-400">{selectedDate.getFullYear()}</span>
            </p>
          </div>
          <button onClick={nextMonth} className="p-3 bg-slate-50 rounded-xl active:scale-90"><ChevronRight size={20}/></button>
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
        <h3 className="text-sm font-black text-slate-800 uppercase ml-2">Resumo Mensal ({months[selectedDate.getMonth()]})</h3>
        
        {sellers.map(s => {
            const rate = s.commissionRate / 100;
            const estimatedCommission = s.sales * rate;
            const commissionToPay = (s.paidReal * rate) - s.consumed;
            // Total Quitado = Dinheiro + Consumo (Refletindo a competência do mês selecionado)
            const totalSettled = s.paidReal + s.consumed;
            
            return (
            <div key={s.id} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-50 relative animate-in slide-in-from-bottom-2">
                
                <div className="flex justify-between items-start mb-4">
                    <button onClick={() => navigate('/historico', { state: { sellerId: s.id, sellerName: s.name } })} className="text-left w-full">
                        <p className="text-lg font-black text-slate-800 uppercase">{s.name}</p>
                        <p className="text-[10px] text-slate-400 font-bold">
                            {s.lastSale ? `Última ativ.: ${new Date(s.lastSale).toLocaleDateString()}` : "Sem atividade recente"}
                        </p>
                    </button>
                    
                    <div className="flex gap-2 absolute right-6 top-6">
                        <button 
                            onClick={() => setSellerToCalculate(s)}
                            className="p-2 bg-indigo-50 text-indigo-400 hover:bg-indigo-100 rounded-xl transition-all"
                            title="Calcular Comissão"
                        >
                            <Calculator size={20}/>
                        </button>
                        <button 
                            onClick={() => requestDeleteSeller(s)} 
                            className="p-2 bg-slate-50 text-slate-300 hover:text-red-400 hover:bg-red-50 rounded-xl transition-all"
                            title="Gerenciar Vendedor"
                        >
                            <Settings size={20}/>
                        </button>
                    </div>
                </div>
                
                {/* Linha 1: Vendas e Total Pago (Compentência) */}
                <div className="flex gap-3 mb-3">
                    <div className="flex-1 bg-green-50 p-3 rounded-2xl border border-green-100">
                        <p className="text-[9px] text-green-600 font-black uppercase flex items-center gap-1"><TrendingUp size={10}/> Vendas</p>
                        <p className="text-lg font-black text-green-700 font-mono">{formatBRL(s.sales)}</p>
                    </div>
                    <div className="flex-1 bg-blue-50 p-3 rounded-2xl border border-blue-100">
                        <p className="text-[9px] text-blue-600 font-black uppercase flex items-center gap-1"><CheckCircle2 size={10}/> Total Pago</p>
                        <p className="text-lg font-black text-blue-700 font-mono">{formatBRL(totalSettled)}</p>
                    </div>
                </div>
                
                {/* Linha 2: Comissão */}
                <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 flex justify-between items-center">
                    <div>
                        <p className="text-[8px] text-indigo-400 font-bold uppercase mb-1">Estimada ({s.commissionRate}%)</p>
                        <p className="text-xs font-black text-indigo-600 font-mono">{formatBRL(estimatedCommission)}</p>
                    </div>
                    
                    <div className="text-right pl-4 border-l border-indigo-200">
                        <p className="text-[8px] text-indigo-500 font-black uppercase flex items-center gap-1 justify-end"><Wallet size={10}/> Saldo a Pagar</p>
                        <p className={`text-xl font-black font-mono ${commissionToPay >= 0 ? 'text-indigo-700' : 'text-red-500'}`}>
                            {formatBRL(commissionToPay)}
                        </p>
                        <p className="text-[8px] text-indigo-300 font-bold uppercase mt-1">Após descontos</p>
                    </div>
                </div>

            </div>
        )})}
        {sellers.length === 0 && <p className="text-center text-slate-400 text-xs py-10">Nenhum vendedor encontrado.</p>}
      </div>
    </div>
  );
};

export default Team;