import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, UserPlus, Search, Users, ChevronRight, Filter } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabase';
import { formatBRL } from '../../utils/formatters';
import { Loader } from '../../components/ui/Loader';

const Customers = () => {
  const { customers, customerTransactions, refreshData } = useData();
  const { session } = useAuth();
  const navigate = useNavigate();
  
  const [search, setSearch] = useState('');
  const [filterDebt, setFilterDebt] = useState(false); // Estado do filtro

  const [isCreating, setIsCreating] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '' });
  const [loading, setLoading] = useState(false);

  // Calcula saldo e aplica filtros
  const customersWithBalance = useMemo(() => {
    return customers.map(c => {
      const myTrans = customerTransactions.filter(t => t.customer_id === c.id);
      const totalPurchase = myTrans.filter(t => t.type === 'purchase').reduce((acc, t) => acc + Number(t.amount), 0);
      const totalPaid = myTrans.filter(t => t.type === 'payment').reduce((acc, t) => acc + Number(t.amount), 0);
      return { ...c, balance: totalPurchase - totalPaid };
    })
    .filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    .filter(c => filterDebt ? c.balance > 0.01 : true) // Se filtro ativo, só mostra devedores
    .sort((a, b) => {
        // Se filtro ativo, ordena por quem deve mais. Se não, ordem alfabética.
        if (filterDebt) return b.balance - a.balance;
        return a.name.localeCompare(b.name);
    });
  }, [customers, customerTransactions, search, filterDebt]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newCustomer.name) return;
    setLoading(true);
    const { error } = await supabase.from('customers').insert([{
      seller_id: session.user.id,
      name: newCustomer.name,
      phone: newCustomer.phone
    }]);

    if (!error) {
      setNewCustomer({ name: '', phone: '' });
      setIsCreating(false);
      refreshData();
    }
    setLoading(false);
  };

  return (
    <div className="p-6 pb-24 space-y-6 animate-in fade-in font-bold">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/')} className="p-3 bg-white rounded-2xl shadow-sm"><ArrowLeft size={20}/></button>
        <h2 className="text-xl font-black text-slate-800 uppercase">Meus Clientes</h2>
      </div>

      {/* Busca e Novo Cliente */}
      <div className="flex gap-2">
        <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input className="w-full pl-12 pr-4 py-4 bg-white rounded-2xl shadow-sm outline-none" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button onClick={() => setIsCreating(true)} className="p-4 bg-yellow-400 text-slate-900 rounded-2xl shadow-sm active:scale-95 transition-all"><UserPlus size={20}/></button>
      </div>

      {/* FILTRO DISCRETO */}
      <div className="flex justify-end px-1">
         <button 
            onClick={() => setFilterDebt(!filterDebt)} 
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all ${
                filterDebt 
                ? 'bg-red-50 text-red-500 border border-red-100' 
                : 'bg-transparent text-slate-400 hover:bg-slate-100'
            }`}
         >
            <Filter size={12} />
            {filterDebt ? 'Exibindo Pagamento Pendente' : 'Filtrar Pagamento Pendente'}
         </button>
      </div>

      {/* Formulário de Criação */}
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

      {/* Lista */}
      <div className="space-y-3">
        {customersWithBalance.length === 0 && !isCreating && <div className="text-center py-10 text-slate-400"><Users size={48} className="mx-auto mb-2 opacity-50"/><p className="text-xs font-bold uppercase">Nenhum cliente encontrado</p></div>}
        
        {customersWithBalance.map(c => (
            <button key={c.id} onClick={() => navigate(`/clientes/${c.id}`)} className="w-full bg-white p-5 rounded-[2rem] shadow-sm flex justify-between items-center border border-slate-50 active:scale-95 transition-all text-left">
                <div>
                    <p className="font-black text-slate-800">{c.name}</p>
                    <p className="text-[10px] text-slate-400 font-bold">{c.phone || "Sem telefone"}</p>
                </div>
                <div className="text-right flex items-center gap-3">
                    <div>
                        <p className="text-[9px] text-slate-400 uppercase font-black">Deve</p>
                        <p className={`font-mono font-black ${c.balance > 0 ? 'text-red-500' : 'text-green-500'}`}>{formatBRL(c.balance)}</p>
                    </div>
                    <ChevronRight size={16} className="text-slate-300"/>
                </div>
            </button>
        ))}
      </div>
    </div>
  );
};

export default Customers;