import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ShoppingBag, X, ArrowLeft, Loader2 } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { formatBRL } from '../utils/formatters';
import AlertModal from '../components/modals/AlertModal';

const Catalog = () => {
  const { products, refreshData } = useData();
  const { session, profile } = useAuth();
  const navigate = useNavigate();

  const [cart, setCart] = useState({});
  const [search, setSearch] = useState('');
  const [showCart, setShowCart] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [alertInfo, setAlertInfo] = useState(null); 
  
  // Função para garantir que não adicione mais do que o estoque (Opcional, mas recomendado)
  const updateCart = (id, delta) => {
    setCart(prev => {
        const currentQty = prev[id] || 0;
        const product = products.find(p => String(p.id) === String(id));
        const maxStock = product?.stock || 0;
        
        const newQty = currentQty + delta;

        // Impede ficar negativo
        if (newQty < 0) return { ...prev, [id]: 0 };
        
        // (Opcional) Impede adicionar mais que o estoque disponível
        if (newQty > maxStock) {
            // Você pode colocar um alerta aqui se quiser
            return prev; 
        }

        return { ...prev, [id]: newQty };
    });
  };
  
  const count = useMemo(() => Object.values(cart).reduce((a, b) => a + b, 0), [cart]);
  
  const total = useMemo(() => Object.entries(cart).reduce((acc, [id, q]) => {
    const p = products.find(prod => String(prod.id) === id);
    return acc + (Number(p?.price || 0) * q);
  }, 0), [cart, products]);

  // --- ALTERAÇÃO AQUI ---
  // Filtra produtos pelo nome E garante que o estoque seja maior que 0
  const filtered = useMemo(() => {
      return products
        .filter(p => (p.stock || 0) > 0) // <--- Oculta estoque 0 ou nulo
        .filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
  }, [products, search]);
  // ----------------------

  const submitOrder = async () => {
    if (isSubmitting) return;

    const cartItems = Object.entries(cart)
      .filter(([_, q]) => q > 0)
      .map(([id, q]) => ({ ...products.find(p => String(p.id) === id), qty: q }));

    if (cartItems.length === 0) return;

    setIsSubmitting(true);

    try {
      const { data: order, error } = await supabase.from('orders').insert([{
        seller_id: session.user.id, 
        seller_name: profile.full_name, 
        total, 
        status: 'pending', 
        type: 'sale'
      }]).select().single();

      if (!error && order) {
        const items = cartItems.map(i => ({ 
            order_id: order.id, 
            product_id: i.id, 
            name: i.name, 
            qty: i.qty, 
            price: i.price 
        }));
        await supabase.from('order_items').insert(items);
        
        // --- ATUALIZAR ESTOQUE (Sugestão) ---
        // Se você quiser abater do estoque automaticamente ao vender, 
        // precisaria fazer um update no banco aqui ou usar uma RPC do Supabase.
        
        setAlertInfo({ type: 'success', title: 'Sucesso', message: 'Pedido enviado para o admin!' });
        
        setTimeout(() => {
            setCart({});
            setShowCart(false);
            setAlertInfo(null);
            refreshData();
            navigate('/');
        }, 1500);

      } else {
         throw error;
      }
    } catch (e) {
      setAlertInfo({ type: 'error', title: 'Erro', message: 'Falha ao enviar o pedido.' });
      setIsSubmitting(false); 
    } 
  };

  return (
    <div className="p-6 pb-40 space-y-4 animate-in fade-in leading-none font-bold">
      <AlertModal 
        isOpen={!!alertInfo} 
        type={alertInfo?.type} 
        title={alertInfo?.title} 
        message={alertInfo?.message} 
        onClose={() => setAlertInfo(null)} 
      />

      <div className="flex items-center gap-3 text-left">
        <button onClick={() => navigate('/')} className="p-3 bg-white rounded-2xl shadow-sm active:scale-90"><ArrowLeft size={20}/></button>
        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter leading-none">Catálogo</h2>
      </div>
      
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input 
            placeholder="Buscar item..." 
            className="w-full pl-12 pr-4 py-4 bg-white rounded-2xl font-bold shadow-sm outline-none" 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
        />
      </div>

      <div className="grid grid-cols-1 gap-3 pb-24">
        {filtered.length === 0 && (
            <div className="text-center py-10 text-slate-400">
                <p>Nenhum produto disponível.</p>
            </div>
        )}

        {filtered.map(p => (
          <div key={p.id} className="bg-white p-5 rounded-[2.2rem] border-2 border-slate-50 flex justify-between items-center shadow-sm text-left">
            <div>
                <p className="font-black text-slate-800 leading-tight">{p.name}</p>
                <div className="flex gap-2 mt-1">
                    <p className="text-indigo-600 font-black text-sm uppercase tracking-widest font-mono leading-none">{formatBRL(p.price)}</p>
                    {/* Mostra estoque restante (Opcional) */}
                    {/* <p className="text-[10px] text-slate-400 font-bold bg-slate-100 px-2 rounded-md leading-none flex items-center">Restam: {p.stock}</p> */}
                </div>
            </div>
            <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-[1.5rem] border border-slate-100">
              <button onClick={() => updateCart(p.id, -1)} className="w-10 h-10 bg-white rounded-xl shadow-sm font-black text-xl active:scale-90 transition-all">-</button>
              <span className="font-black w-5 text-center text-slate-800">{cart[p.id] || 0}</span>
              <button onClick={() => updateCart(p.id, 1)} className="w-10 h-10 bg-yellow-400 text-slate-900 rounded-xl shadow-sm font-black text-xl active:scale-90 transition-all">+</button>
            </div>
          </div>
        ))}
      </div>

      {count > 0 && !showCart && (
        <div className="fixed bottom-6 left-4 right-4 bg-slate-900 text-white p-4 rounded-[2rem] flex justify-between items-center shadow-2xl border-b-4 border-yellow-400 animate-in slide-in-from-bottom-12 z-50">
          <div className="text-left leading-none pl-2">
              <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest mb-1">{count} itens</p>
              <p className="text-xl font-black text-yellow-400 font-mono tracking-tighter leading-none">{formatBRL(total)}</p>
          </div>
          
          <button 
            onClick={() => setShowCart(true)} 
            className="bg-white text-slate-900 px-6 py-3 rounded-[1.2rem] font-black text-xs uppercase active:scale-95 transition-all shadow-lg flex items-center gap-2"
          >
            <ShoppingBag size={16}/> 
            <span>Ver Carrinho</span>
          </button>
        </div>
      )}

      {showCart && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[300] flex items-end sm:items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-6 shadow-2xl animate-in slide-in-from-bottom-10 space-y-6 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-black text-slate-800 uppercase leading-none">Seu Carrinho</h3>
              <button onClick={() => setShowCart(false)} className="p-2 bg-slate-100 rounded-full"><X size={24}/></button>
            </div>
            <div className="space-y-3">
              {Object.entries(cart).filter(([_, q]) => q > 0).map(([id, qty]) => {
                const p = products.find(prod => String(prod.id) === id);
                return (
                  <div key={id} className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <p className="font-bold text-slate-800">{p?.name}</p>
                    <div className="flex items-center gap-3">
                      <button onClick={() => updateCart(id, -1)} className="w-8 h-8 rounded-lg bg-white shadow-sm font-bold text-slate-500">-</button>
                      <span className="font-bold w-4 text-center">{qty}</span>
                      <button onClick={() => updateCart(id, 1)} className="w-8 h-8 rounded-lg bg-indigo-600 shadow-sm font-bold text-white">+</button>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="pt-4 border-t border-slate-100">
              <div className="flex justify-between items-center mb-4"><p className="text-xs font-bold text-slate-400 uppercase">Total</p><p className="text-2xl font-black text-indigo-700 font-mono">{formatBRL(total)}</p></div>
              
              <button 
                onClick={submitOrder} 
                disabled={isSubmitting}
                className="w-full py-4 bg-yellow-400 text-slate-900 rounded-2xl font-black uppercase text-sm shadow-lg active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : "Enviar Pedido"}
              </button>
            
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Catalog;