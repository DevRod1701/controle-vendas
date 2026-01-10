import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, User, Save, Plus, Trash2, AlertCircle, Tag, Search, X, Package, CheckCircle2 } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { supabase } from '../../services/supabase';
import { formatBRL } from '../../utils/formatters';
import AlertModal from '../../components/modals/AlertModal';

const RetroImport = () => {
  const navigate = useNavigate();
  const { products, refreshData } = useData();
  
  // Estados Gerais
  const [profiles, setProfiles] = useState([]);
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [alertInfo, setAlertInfo] = useState(null);

  // NOVO: Estado para controlar o Modal de Revisão
  const [showReviewModal, setShowReviewModal] = useState(false);

  // --- SELEÇÃO DE VENDEDOR (BUSCA) ---
  const [selectedSeller, setSelectedSeller] = useState('');
  const [sellerSearch, setSellerSearch] = useState('');
  const [showSellerList, setShowSellerList] = useState(false);

  // --- SELEÇÃO DE PRODUTO (BUSCA) ---
  const [selectedProduct, setSelectedProduct] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [showProductList, setShowProductList] = useState(false);

  // Carrinho e Opções
  const [cart, setCart] = useState([]);
  const [qty, setQty] = useState(1);
  const [itemDiscount, setItemDiscount] = useState('');
  const [isPaid, setIsPaid] = useState(true);
  const [updateStock, setUpdateStock] = useState(false);

  // Busca lista de vendedores ao carregar
  useEffect(() => {
    const fetchSellers = async () => {
        const { data } = await supabase.from('profiles').select('*').eq('role', 'vendedor');
        if(data) setProfiles(data);
    };
    fetchSellers();
  }, []);

  // Filtros de Busca
  const filteredSellers = useMemo(() => {
    return profiles.filter(p => (p.name || p.full_name).toLowerCase().includes(sellerSearch.toLowerCase()));
  }, [profiles, sellerSearch]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()));
  }, [products, productSearch]);

  // Labels para exibição
  const currentSellerName = profiles.find(p => p.id === selectedSeller)?.name || profiles.find(p => p.id === selectedSeller)?.full_name || 'Selecione...';
  const currentProductName = products.find(p => p.id === selectedProduct)?.name || 'Selecione...';

  // Cálculos
  const total = useMemo(() => cart.reduce((acc, item) => acc + (item.price * item.qty), 0), [cart]);

  const addToCart = () => {
      if(!selectedProduct || qty < 1) return;
      const prod = products.find(p => p.id === selectedProduct);
      
      const discountVal = parseFloat(itemDiscount) || 0;
      const finalPrice = Math.max(0, prod.price - discountVal);

      setCart(prev => [...prev, { 
          ...prod, 
          qty: parseInt(qty),
          price: finalPrice, 
          originalPrice: prod.price,
          discount: discountVal 
      }]);
      
      // Reseta seleção de produto
      setSelectedProduct('');
      setProductSearch('');
      setQty(1);
      setItemDiscount('');
      setShowProductList(false);
  };

  const removeFromCart = (index) => {
      setCart(prev => prev.filter((_, i) => i !== index));
  };

  // Função auxiliar para ajustar data
  const getSafeDate = (dateString) => {
    // Cria a data com horário 12:00:00 para evitar problemas de fuso horário
    const d = new Date(dateString + 'T12:00:00');
    return d.toISOString();
  };

  // Validação antes de abrir o modal
  const handleOpenReview = () => {
    if (!selectedSeller || !date || cart.length === 0) {
        setAlertInfo({ type: 'error', title: 'Campos Vazios', message: 'Preencha vendedor, data e adicione produtos.' });
        return;
    }
    setShowReviewModal(true);
  };

  const handleImport = async () => {
    setShowReviewModal(false); // Fecha o modal de revisão
    setLoading(true);

    try {
        const seller = profiles.find(p => p.id === selectedSeller);
        const safeIsoDate = getSafeDate(date); 

        // 1. Criar Pedido
        const { data: order, error: orderError } = await supabase.from('orders').insert([{
            seller_id: seller.id,
            seller_name: seller.full_name || seller.name,
            total: total,
            status: 'approved',
            type: 'sale',
            created_at: safeIsoDate, 
            paid: isPaid ? total : 0
        }]).select().single();

        if (orderError) throw orderError;

        // 2. Criar Itens
        const orderItems = cart.map(item => ({
            order_id: order.id,
            product_id: item.id,
            name: item.name,
            qty: item.qty,
            price: item.price
        }));

        const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
        if (itemsError) throw itemsError;

        // 3. Atualizar Estoque (Opcional)
        if (updateStock) {
            for (const item of cart) {
                const currentProd = products.find(p => p.id === item.id);
                if (currentProd) {
                    await supabase.from('products').update({ stock: currentProd.stock - item.qty }).eq('id', item.id);
                }
            }
        }

        // 4. Criar Pagamento (Opcional)
        if (isPaid) {
            await supabase.from('payments').insert([{
                order_id: order.id,
                amount: total,
                method: 'Importado',
                date: safeIsoDate, 
                description: 'Importação Retroativa'
            }]);
        }

        setAlertInfo({ type: 'success', title: 'Sucesso', message: 'Venda antiga importada!' });
        setCart([]);
        refreshData();

    } catch (error) {
        console.error(error);
        let msg = 'Falha ao importar venda.';
        if (error.code === '42501' || error.status === 403 || (error.message && error.message.includes('row-level security'))) {
            msg = 'Permissão Negada: O banco de dados bloqueou esta ação. Verifique se você é Admin.';
        }
        setAlertInfo({ type: 'error', title: 'Erro', message: msg });
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="p-6 pb-24 space-y-6 animate-in fade-in font-bold min-h-screen bg-slate-50">
      <AlertModal isOpen={!!alertInfo} type={alertInfo?.type} title={alertInfo?.title} message={alertInfo?.message} onClose={() => setAlertInfo(null)} />

      {/* MODAL DE REVISÃO (NOVO) */}
      {showReviewModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[400] flex items-center justify-center p-6 animate-in fade-in">
            <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-6 shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[85vh]">
                <div className="text-center mb-4">
                    <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3 text-indigo-600">
                        <CheckCircle2 size={24}/>
                    </div>
                    <h3 className="text-xl font-black text-slate-800 uppercase leading-none">Revisar Importação</h3>
                    <p className="text-xs text-slate-400 font-bold mt-1">Confira os dados antes de lançar</p>
                </div>

                <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                    {/* Resumo Cabeçalho */}
                    <div className="bg-slate-50 p-4 rounded-2xl space-y-2 text-xs border border-slate-100">
                        <div className="flex justify-between">
                            <span className="text-slate-500 font-bold">Vendedor:</span>
                            <span className="font-black text-slate-800 text-right truncate max-w-[150px]">{currentSellerName}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500 font-bold">Data Real:</span>
                            <span className="font-black text-slate-800">{new Date(date + 'T12:00:00').toLocaleDateString()}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-slate-200 mt-2">
                            <span className="text-slate-500 font-bold">Status:</span>
                            <span className={`font-black px-2 py-0.5 rounded text-[10px] uppercase ${isPaid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {isPaid ? 'PAGO' : 'PENDENTE'}
                            </span>
                        </div>
                    </div>

                    {/* Lista de Itens */}
                    <div className="space-y-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Itens do Pedido</p>
                        {cart.map((item, i) => (
                            <div key={i} className="flex justify-between text-xs border-b border-slate-100 pb-2 last:border-0">
                                <div>
                                    <span className="font-bold text-slate-700">{item.qty}x {item.name}</span>
                                    {item.discount > 0 && <span className="block text-[9px] text-red-400">Desc: -{formatBRL(item.discount)}</span>}
                                </div>
                                <span className="font-mono font-bold text-slate-600">{formatBRL(item.price * item.qty)}</span>
                            </div>
                        ))}
                        <div className="flex justify-between text-sm font-black pt-2 bg-indigo-50 p-3 rounded-xl border border-indigo-100 text-indigo-900">
                            <span>TOTAL FINAL</span>
                            <span>{formatBRL(total)}</span>
                        </div>
                    </div>

                    {/* Alerta de Estoque */}
                    {updateStock && (
                        <div className="bg-red-50 p-3 rounded-xl flex items-start gap-2 border border-red-100">
                            <AlertCircle size={14} className="text-red-500 mt-0.5 flex-shrink-0"/>
                            <p className="text-[10px] text-red-600 font-bold leading-tight">
                                Atenção: Esta importação irá <span className="underline">reduzir o estoque atual</span> dos produtos.
                            </p>
                        </div>
                    )}
                </div>

                <div className="flex gap-3 mt-6 pt-2 border-t border-slate-50">
                    <button onClick={() => setShowReviewModal(false)} className="flex-1 py-3 bg-slate-100 rounded-xl font-bold text-slate-500 uppercase text-xs active:scale-95 transition-all">
                        Voltar
                    </button>
                    <button onClick={handleImport} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold uppercase text-xs shadow-lg shadow-indigo-200 active:scale-95 transition-all flex items-center justify-center gap-2">
                        <Save size={16}/> Confirmar
                    </button>
                </div>
            </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/')} className="p-3 bg-white rounded-2xl shadow-sm"><ArrowLeft size={20}/></button>
        <h2 className="text-xl font-black text-slate-800 uppercase">Importar Vendas</h2>
      </div>

      <div className="bg-yellow-50 p-4 rounded-3xl border border-yellow-200 flex gap-3 items-start">
        <AlertCircle className="text-yellow-600 flex-shrink-0 mt-1" size={20}/>
        <p className="text-xs text-yellow-800 font-bold">Use esta ferramenta para lançar vendas passadas. Elas entrarão diretamente como "Aprovadas".</p>
      </div>

      <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-50 space-y-4 relative">
        
        {/* --- LINHA 1: VENDEDOR E DATA --- */}
        <div className="grid grid-cols-2 gap-3">
            
            {/* Busca de Vendedor Customizada */}
            <div className="space-y-1 relative">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Vendedor</label>
                <button 
                    onClick={() => { setShowSellerList(!showSellerList); setShowProductList(false); }}
                    className="w-full pl-3 pr-3 py-3 bg-slate-50 rounded-xl text-xs font-bold outline-none flex justify-between items-center border border-transparent focus:border-indigo-200"
                >
                    <div className="flex items-center gap-2 truncate">
                        <User size={14} className="text-slate-400 flex-shrink-0"/>
                        <span className={selectedSeller ? 'text-slate-800' : 'text-slate-400'}>
                            {currentSellerName}
                        </span>
                    </div>
                </button>

                {/* Dropdown de Vendedores */}
                {showSellerList && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-100 z-50 p-2 max-h-48 overflow-y-auto">
                        <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg mb-1 sticky top-0">
                            <Search size={12} className="text-slate-400"/>
                            <input 
                                className="bg-transparent w-full text-xs font-bold outline-none" 
                                placeholder="Buscar..." 
                                value={sellerSearch}
                                onChange={e => setSellerSearch(e.target.value)}
                                autoFocus
                            />
                        </div>
                        {filteredSellers.map(s => (
                            <button 
                                key={s.id} 
                                onClick={() => { setSelectedSeller(s.id); setShowSellerList(false); setSellerSearch(''); }}
                                className="w-full text-left p-2 text-xs font-bold text-slate-700 hover:bg-yellow-50 rounded-lg truncate"
                            >
                                {s.name || s.full_name}
                            </button>
                        ))}
                        {filteredSellers.length === 0 && <p className="text-[10px] text-center p-2 text-slate-400">Nada encontrado</p>}
                    </div>
                )}
            </div>
            
            {/* Campo de Data */}
            <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Data da Venda</label>
                <div className="relative">
                    <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                    <input 
                        type="date" 
                        className="w-full pl-9 pr-2 py-3 bg-slate-50 rounded-xl text-xs font-bold outline-none text-slate-600"
                        value={date}
                        onChange={e => setDate(e.target.value)}
                    />
                </div>
            </div>
        </div>

        {/* --- LINHA 2: ADICIONAR PRODUTOS (BUSCA) --- */}
        <div className="space-y-2 pt-2 border-t border-slate-100 relative">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Adicionar Itens</label>
            
            {/* Busca de Produtos Customizada */}
            <div className="relative">
                <button 
                    onClick={() => { setShowProductList(!showProductList); setShowSellerList(false); }}
                    className="w-full p-3 bg-slate-50 rounded-xl text-xs font-bold outline-none flex justify-between items-center border border-transparent focus:border-indigo-200"
                >
                    <div className="flex items-center gap-2 truncate">
                        <Package size={14} className="text-slate-400 flex-shrink-0"/>
                        <span className={selectedProduct ? 'text-slate-800' : 'text-slate-400'}>
                            {currentProductName}
                        </span>
                    </div>
                </button>

                {/* Dropdown de Produtos */}
                {showProductList && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-100 z-40 p-2 max-h-48 overflow-y-auto">
                         <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg mb-1 sticky top-0">
                            <Search size={12} className="text-slate-400"/>
                            <input 
                                className="bg-transparent w-full text-xs font-bold outline-none" 
                                placeholder="Buscar produto..." 
                                value={productSearch}
                                onChange={e => setProductSearch(e.target.value)}
                                autoFocus
                            />
                        </div>
                        {filteredProducts.map(p => (
                            <button 
                                key={p.id} 
                                onClick={() => { setSelectedProduct(p.id); setShowProductList(false); setProductSearch(''); }}
                                className="w-full text-left p-2 text-xs font-bold text-slate-700 hover:bg-yellow-50 rounded-lg flex justify-between"
                            >
                                <span>{p.name}</span>
                                <span className="font-mono text-slate-400">{formatBRL(p.price)}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Controles de Quantidade e Desconto */}
            <div className="flex gap-2 items-center">
                <div className="relative w-20">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] font-bold">Qtd</span>
                    <input 
                        type="number" 
                        className="w-full p-3 pl-8 bg-slate-50 rounded-xl text-xs font-bold outline-none text-center"
                        value={qty}
                        onChange={e => setQty(e.target.value)}
                    />
                </div>

                <div className="relative flex-1">
                    <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                    <input 
                        type="number" 
                        step="0.01"
                        className="w-full p-3 pl-9 bg-slate-50 rounded-xl text-xs font-bold outline-none focus:bg-red-50 focus:text-red-500 transition-colors placeholder:text-slate-300"
                        value={itemDiscount}
                        onChange={e => setItemDiscount(e.target.value)}
                        placeholder="Desc. Unit. (R$)"
                    />
                </div>

                <button onClick={addToCart} className="p-3 bg-indigo-600 text-white rounded-xl shadow-md active:scale-90 transition-all">
                    <Plus size={16}/>
                </button>
            </div>
        </div>

        {/* Lista do Carrinho */}
        {cart.length > 0 && (
            <div className="bg-slate-50 p-4 rounded-2xl space-y-2 border border-slate-100">
                {cart.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs font-bold border-b border-slate-200 pb-2 last:border-0 last:pb-0">
                        <div>
                            <span>{item.qty}x {item.name}</span>
                            {item.discount > 0 && (
                                <span className="block text-[9px] text-red-400 font-normal">
                                    Desconto: -{formatBRL(item.discount)}/un
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="text-right">
                                {item.discount > 0 && (
                                    <span className="block text-[9px] text-slate-400 line-through">
                                        {formatBRL(item.originalPrice * item.qty)}
                                    </span>
                                )}
                                <span>{formatBRL(item.price * item.qty)}</span>
                            </div>
                            <button onClick={() => removeFromCart(idx)} className="p-1 bg-white rounded-md shadow-sm active:scale-90"><Trash2 size={14} className="text-red-400"/></button>
                        </div>
                    </div>
                ))}
                <div className="flex justify-between items-center pt-2 text-sm font-black text-slate-800 border-t-2 border-dashed border-slate-200 mt-2">
                    <span>TOTAL</span>
                    <span>{formatBRL(total)}</span>
                </div>
            </div>
        )}

        {/* Opções Finais */}
        <div className="flex flex-col gap-2 pt-2">
            <label className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                <input type="checkbox" checked={isPaid} onChange={e => setIsPaid(e.target.checked)} className="w-4 h-4 accent-green-500 rounded"/>
                <span className="text-xs font-bold text-slate-600">Marcar como JÁ PAGO</span>
            </label>
            <label className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl cursor-pointer opacity-75 hover:opacity-100 transition-opacity">
                <input type="checkbox" checked={updateStock} onChange={e => setUpdateStock(e.target.checked)} className="w-4 h-4 accent-red-500 rounded"/>
                <span className="text-xs font-bold text-slate-500">Baixar do Estoque atual? (Cuidado)</span>
            </label>
        </div>

        {/* BOTÃO PRINCIPAL AGORA ABRE A REVISÃO */}
        <button 
            onClick={handleOpenReview} 
            disabled={loading}
            className="w-full py-4 bg-green-500 text-white rounded-2xl font-black uppercase text-sm shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
        >
            <Save size={18}/> {loading ? 'Importando...' : 'Lançar Venda Antiga'}
        </button>

      </div>
    </div>
  );
};

export default RetroImport;