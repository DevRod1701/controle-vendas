import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, UserPlus, Search, Users, ChevronRight, ChevronLeft, Filter, Phone, Calendar, Clock, List } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabase';
import { formatBRL } from '../../utils/formatters';
import { Loader } from '../../components/ui/Loader';

const Customers = () => {
  const { customers, customerTransactions, refreshData } = useData();
  const { session } = useAuth();
  const navigate = useNavigate();
  
  // --- ESTADOS ---
  const [search, setSearch] = useState('');
  const [filterDebt, setFilterDebt] = useState(false); // Apenas Devedores?
  
  // Filtros de Tempo: 'all' (Geral), 'month' (Mês), 'day' (Dia Específico)
  const [viewMode, setViewMode] = useState('all'); 
  
  // Controles de Data
  const [month, setMonth] = useState(new Date().getMonth());
  const [year, setYear] = useState(new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const [isCreating, setIsCreating] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '' });
  const [loading, setLoading] = useState(false);

  const monthsList = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  // --- NAVEGAÇÃO DE MÊS ---
  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(year - 1); } else { setMonth(month - 1); } };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(year + 1); } else { setMonth(month + 1); } };

  // --- LÓGICA PRINCIPAL ---
  const customersWithBalance = useMemo(() => {
    return customers.map(c => {
      // 1. Filtra transações do cliente
      const allTrans = customerTransactions.filter(t => t.customer_id === c.id);
      let relevantTrans = allTrans;

      // 2. Aplica Filtro de Tempo
      if (viewMode === 'month') {
          relevantTrans = allTrans.filter(t => {
              const tDate = new Date(t.date + 'T12:00:00');
              return tDate.getMonth() === month && tDate.getFullYear() === year;
          });
      } else if (viewMode === 'day') {
          relevantTrans = allTrans.filter(t => t.date === selectedDate);
      }
      
      // 3. Calcula Saldo
      const totalPurchase = relevantTrans.filter(t => t.type === 'purchase').reduce((acc, t) => acc + Number(t.amount), 0);
      const totalPaid = relevantTrans.filter(t => t.type === 'payment').reduce((acc, t) => acc + Number(t.amount), 0);
      const balance = totalPurchase - totalPaid;

      // Se teve movimentação no período (importante para não mostrar lista vazia nos filtros de tempo)
      const hasActivity = relevantTrans.length > 0;

      return { 
          ...c, 
          balance,
          hasActivity,
          transactionsCount: relevantTrans.length
      };
    })
    .filter(c => c.name.toLowerCase().includes(search.toLowerCase())) // Filtro Nome
    .filter(c => {
        // Lógica de Exibição
        if (filterDebt) return c.balance > 0.01; // Se ativado "Apenas Devedores", esconde quem tá zerado/negativo
        
        // Se estiver filtrando por tempo (mês ou dia), só mostra quem teve atividade OU quem tem saldo pendente gerado nesse dia
        if (viewMode !== 'all') return c.hasActivity; 
        
        return true; // No modo geral, mostra todos
    })
    .sort((a, b) => {
        // Quem deve mais aparece primeiro se o filtro de dívida estiver ativo
        if (filterDebt) return b.balance - a.balance;
        // Senão, ordem alfabética
        return a.name.localeCompare(b.name);
    });
  }, [customers, customerTransactions, search, filterDebt, viewMode, month, year, selectedDate]);

  const totalDebtVisible = useMemo(() => {
    return customersWithBalance.reduce((acc, c) => acc + (c.balance > 0 ? c.balance : 0), 0);
  }, [customersWithBalance]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newCustomer.name) return;
    setLoading(true);
    const { error } = await supabase.from('customers').insert([{ seller_id: session.user.id, name: newCustomer.name, phone: newCustomer.phone }]);
    if (!error) { setNewCustomer({ name: '', phone: '' }); setIsCreating(false); refreshData(); }
    setLoading(false);
  };

  return (
    <div className="p-6 pb-24 space-y-4 animate-in fade-in font-bold">
      
      {/* HEADER */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/')} className="p-3 bg-white rounded-2xl shadow-sm"><ArrowLeft size={20}/></button>
        <h2 className="text-xl font-black text-slate-800 uppercase">Meus Clientes</h2>
      </div>

      {/* BUSCA + NOVO */}
      <div className="flex gap-2">
        <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input className="w-full pl-12 pr-4 py-4 bg-white rounded-2xl shadow-sm outline-none text-slate-700" placeholder="Buscar nome..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button onClick={() => setIsCreating(true)} className="p-4 bg-yellow-400 text-slate-900 rounded-2xl shadow-sm active:scale-95 transition-all"><UserPlus size={20}/></button>
      </div>

      {/* PAINEL DE FILTROS */}
      <div className="bg-white p-3 rounded-[2rem] shadow-sm space-y-3 border border-slate-50">
          
          {/* Abas de Modo */}
          <div className="flex bg-slate-100 p-1 rounded-2xl">
              <button onClick={() => setViewMode('all')} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-1 ${viewMode === 'all' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400'}`}>
                  <List size={12}/> Geral
              </button>
              <button onClick={() => setViewMode('month')} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-1 ${viewMode === 'month' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400'}`}>
                  <Calendar size={12}/> Mês
              </button>
              <button onClick={() => setViewMode('day')} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-1 ${viewMode === 'day' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400'}`}>
                  <Clock size={12}/> Dia
              </button>
          </div>

          {/* Sub-Filtros Condicionais */}
          {viewMode === 'month' && (
              <div className="flex items-center justify-between bg-slate-50 p-2 rounded-xl animate-in slide-in-from-top-2">
                  <button onClick={prevMonth} className="p-2 bg-white rounded-lg shadow-sm active:scale-90 text-slate-600"><ChevronLeft size={16}/></button>
                  <div className="text-center leading-none">
                      <p className="text-[9px] font-black text-indigo-600 uppercase mb-0.5">{year}</p>
                      <p className="text-sm font-black text-slate-800 uppercase">{monthsList[month]}</p>
                  </div>
                  <button onClick={nextMonth} className="p-2 bg-white rounded-lg shadow-sm active:scale-90 text-slate-600"><ChevronRight size={16}/></button>
              </div>
          )}

          {viewMode === 'day' && (
              <div className="bg-slate-50 p-2 rounded-xl animate-in slide-in-from-top-2">
                  <input type="date" className="w-full p-3 bg-white rounded-xl font-bold text-slate-700 outline-none border border-slate-100 text-center uppercase text-sm" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
              </div>
          )}

          {/* Toggle Devedores + Totalizador */}
          <div className="flex justify-between items-center px-1">
              <button onClick={() => setFilterDebt(!filterDebt)} className={`flex items-center gap-2 text-[10px] font-black uppercase transition-colors ${filterDebt ? 'text-red-500' : 'text-slate-400'}`}>
                <div className={`w-5 h-5 rounded-lg border flex items-center justify-center ${filterDebt ? 'bg-red-500 border-red-500 text-white' : 'border-slate-300 bg-white'}`}>
                    {filterDebt && <Filter size={10}/>}
                </div>
                Só Devedores
              </button>

              {totalDebtVisible > 0 && (
                  <span className="text-[10px] font-black text-red-500 bg-red-50 px-3 py-1.5 rounded-lg border border-red-100">
                      Total: {formatBRL(totalDebtVisible)}
                  </span>
              )}
          </div>
      </div>

      {/* FORMULÁRIO NOVO CLIENTE */}
      {isCreating && (
        <form onSubmit={handleCreate} className="bg-white p-6 rounded-[2.5rem] shadow-lg border-2 border-yellow-100 animate-in slide-in-from-top-4 space-y-4">
            <h3 className="text-sm font-black text-slate-800 uppercase">Novo Cliente</h3>
            <input className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none" placeholder="Nome do Cliente" value={newCustomer.name} onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} autoFocus required />
            <input className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none" placeholder="Telefone (Opcional)" value={newCustomer.phone} onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})} type="tel" />
            <div className="flex gap-2">
                <button type="button" onClick={() => setIsCreating(false)} className="flex-1 py-3 bg-slate-100 rounded-xl text-xs font-black uppercase">Cancelar</button>
                <button type="submit" disabled={loading} className="flex-1 py-3 bg-yellow-400 text-slate-900 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-2">
                    {loading ? <Loader size={16} className="animate-spin"/> : 'Cadastrar'}
                </button>
            </div>
        </form>
      )}

      {/* LISTA DE CLIENTES */}
      <div className="space-y-3">
        {customersWithBalance.length === 0 && !isCreating && (
            <div className="text-center py-10 text-slate-400">
                <Users size={48} className="mx-auto mb-2 opacity-50"/>
                <p className="text-xs font-bold uppercase">Nenhum registro encontrado.</p>
            </div>
        )}
        
        {customersWithBalance.map(c => (
            <button key={c.id} onClick={() => navigate(`/clientes/${c.id}`)} className="w-full bg-white p-5 rounded-[2rem] shadow-sm flex justify-between items-center border border-slate-50 active:scale-[0.98] transition-all text-left">
                
                {/* LADO ESQUERDO: Nome e Telefone */}
                <div>
                    <p className="font-black text-slate-800 text-sm">{c.name}</p>
                    <div className="flex items-center gap-1 mt-1 text-slate-400">
                        <Phone size={12}/>
                        <p className="text-[11px] font-bold">{c.phone || "Sem contato"}</p>
                    </div>
                </div>
                
                {/* LADO DIREITO: Valor e Label */}
                <div className="text-right">
                    {c.balance > 0.01 ? (
                        <>
                            <p className="text-base font-black text-red-500 font-mono">{formatBRL(c.balance)}</p>
                            <p className="text-[9px] font-bold text-red-300 uppercase">Devendo</p>
                        </>
                    ) : c.balance < -0.01 ? (
                        <>
                            <p className="text-base font-black text-green-500 font-mono">{formatBRL(Math.abs(c.balance))}</p>
                            <p className="text-[9px] font-bold text-green-400 uppercase">Crédito</p>
                        </>
                    ) : (
                        <>
                            <p className="text-base font-black text-green-500 font-mono">0,00</p>
                            <p className="text-[9px] font-bold text-green-400 uppercase">Quitado</p>
                        </>
                    )}
                </div>
            </button>
        ))}
      </div>
    </div>
  );
};

export default Customers;