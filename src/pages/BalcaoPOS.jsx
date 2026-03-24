import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ShoppingCart, Plus, Minus, X, User, CreditCard, Banknote, QrCode, Bike, Store, CheckCircle2, Loader2, Printer, History, ArrowLeft, Trash2, LogOut, Lock, ChevronDown, ChevronUp, Calculator, Calendar, ListFilter } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { formatBRL } from '../utils/formatters';
import { executePrint } from '../utils/printHandler';
import { pdvTemplate } from '../utils/print/pdvTemplate';

const getTodayLocal = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const getMonthLocal = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const BalcaoPOS = () => {
  const navigate = useNavigate();
  const { products, orders, refreshData } = useData();
  const { session, profile, isAdmin } = useAuth();
  
  const [activeTab, setActiveTab] = useState('pdv'); 
  
  // Estados do PDV
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [orderType, setOrderType] = useState('balcao'); 
  const [customer, setCustomer] = useState({ name: '', phone: '', cep: '', street: '', number: '', neighborhood: '', complement: '' });
  const [paymentMethod, setPaymentMethod] = useState('Cartão');
  const [paymentStatus, setPaymentStatus] = useState('paid'); 
  const [cashReceived, setCashReceived] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successOrder, setSuccessOrder] = useState(null);

  // Estados do Histórico
  const [historyFilter, setHistoryFilter] = useState('day'); // 'day', 'month', 'all'
  const [filterDate, setFilterDate] = useState(getTodayLocal());
  const [filterMonth, setFilterMonth] = useState(getMonthLocal());
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [orderItemsLoaded, setOrderItemsLoaded] = useState([]);
  const [orderPaymentsLoaded, setOrderPaymentsLoaded] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  
  // Adição de Pagamento (Acerto)
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [newPaymentAmount, setNewPaymentAmount] = useState('');
  const [newPaymentMethod, setNewPaymentMethod] = useState('Dinheiro');

  // Estados do PIN (Exclusão)
  const [showPinModal, setShowPinModal] = useState(false);
  const [adminPin, setAdminPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinAction, setPinAction] = useState({ type: null, payload: null }); // type: 'order' ou 'payment'

  const filteredProducts = useMemo(() => {
      if (!search) return products;
      return products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
  }, [products, search]);

  const cartTotal = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
  const cartItemsCount = cart.reduce((acc, item) => acc + item.qty, 0);
  const changeAmount = paymentMethod === 'Dinheiro' && cashReceived ? Math.max(0, Number(cashReceived) - cartTotal) : 0;

  // Filtra histórico do PDV geral
  const allPosOrders = useMemo(() => {
      return orders.filter(o => o.metadata && (o.metadata.order_type === 'balcao' || o.metadata.order_type === 'delivery'));
  }, [orders]);

  // Histórico com base no filtro selecionado (Dia, Mês, Geral)
  const displayedHistory = useMemo(() => {
      let filtered = allPosOrders;
      if (historyFilter === 'day') {
          filtered = filtered.filter(o => o.created_at.startsWith(filterDate));
      } else if (historyFilter === 'month') {
          filtered = filtered.filter(o => o.created_at.startsWith(filterMonth));
      }
      return filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [allPosOrders, historyFilter, filterDate, filterMonth]);

  // Balanço (Sempre baseado no dia de hoje)
  const todayBalance = useMemo(() => {
      const todayStr = getTodayLocal();
      const todayOrders = allPosOrders.filter(o => o.created_at.startsWith(todayStr));
      const totals = { total: 0, Dinheiro: 0, Pix: 0, Cartão: 0, pendente: 0 };
      
      todayOrders.forEach(o => {
          totals.total += Number(o.total);
          // O saldo pendente real é Total - Pago
          const paid = Number(o.paid || 0);
          const total = Number(o.total || 0);
          const pendente = Math.max(0, total - paid);
          
          totals.pendente += pendente;
          
          // Se houve pagamento total ou parcial na hora da criação
          if (paid > 0) {
              const method = o.payment_method || 'Dinheiro';
              if (totals[method] !== undefined) totals[method] += paid;
          }
      });
      return totals;
  }, [allPosOrders]);

  // --- FUNÇÕES DO CARRINHO ---
  const addToCart = (product) => {
      setCart(prev => {
          const exists = prev.find(i => i.id === product.id);
          if (exists) return prev.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i);
          return [...prev, { ...product, qty: 1 }];
      });
  };

  const updateQty = (id, delta) => {
      setCart(prev => prev.map(item => {
          if (item.id === id) {
              const newQty = item.qty + delta;
              return newQty > 0 ? { ...item, qty: newQty } : item;
          }
          return item;
      }).filter(item => item.qty > 0));
  };

  const handleCepChange = async (e) => {
      const val = e.target.value.replace(/\D/g, '');
      setCustomer(prev => ({ ...prev, cep: val }));
      
      if (val.length === 8) {
          try {
              const res = await fetch(`https://viacep.com.br/ws/${val}/json/`);
              const data = await res.json();
              if (!data.erro) {
                  setCustomer(prev => ({ 
                      ...prev, 
                      street: data.logradouro || '', 
                      neighborhood: data.bairro || '',
                      complement: data.complemento || ''
                  }));
              }
          } catch (err) {
              console.error("Erro ao buscar CEP");
          }
      }
  };

  // --- FINALIZAÇÃO DE PEDIDO ---
  const handleCheckout = async () => {
      if (cart.length === 0) return;
      if (orderType === 'delivery' && (!customer.name || !customer.street || !customer.number)) {
          alert("Preencha o Nome, Rua e Número para entrega.");
          return;
      }
      
      const finalCustomerName = customer.name.trim() || "Cliente Balcão";
      setIsSubmitting(true);

      const metadata = {
          order_type: orderType,
          customer_info: { ...customer, name: finalCustomerName },
          payment_status: paymentStatus,
          cash_received: paymentMethod === 'Dinheiro' && paymentStatus === 'paid' ? Number(cashReceived) : 0,
          change_amount: changeAmount
      };

      try {
          const { data: newOrder, error: orderError } = await supabase.from('orders').insert([{
              seller_id: session.user.id,
              seller_name: profile?.full_name || 'Balcão',
              status: 'approved',
              total: cartTotal,
              paid: paymentStatus === 'paid' ? cartTotal : 0,
              type: 'sale',
              payment_method: paymentMethod,
              metadata: metadata
          }]).select().single();

          if (orderError) throw orderError;

          const itemsToInsert = cart.map(item => ({
              order_id: newOrder.id,
              product_id: item.id,
              name: item.name,
              qty: item.qty,
              price: item.price
          }));
          await supabase.from('order_items').insert(itemsToInsert);

          for (const item of cart) {
              await supabase.from('products').update({ stock: item.stock - item.qty }).eq('id', item.id);
          }

          if (paymentStatus === 'paid') {
              await supabase.from('payments').insert([{
                  order_id: newOrder.id,
                  amount: cartTotal,
                  method: paymentMethod,
                  status: 'approved',
                  description: `Venda PDV - ${orderType.toUpperCase()}`,
                  approved_by: session.user.id,
                  approver_name: profile?.full_name || 'Balcão',
                  approved_at: new Date().toISOString()
              }]);
          }

          const fullOrder = { ...newOrder, order_items: itemsToInsert };
          setSuccessOrder(fullOrder);
          refreshData();

      } catch (error) {
          console.error(error);
          alert("Erro ao finalizar pedido.");
      } finally {
          setIsSubmitting(false);
      }
  };

  // --- HISTÓRICO, ITENS E PAGAMENTOS ---
  const toggleOrderDetails = async (orderId) => {
      if (expandedOrder === orderId) {
          setExpandedOrder(null);
          setShowPaymentForm(false);
          return;
      }
      setExpandedOrder(orderId);
      setShowPaymentForm(false);
      setLoadingItems(true);
      
      const [itemsRes, payRes] = await Promise.all([
          supabase.from('order_items').select('*').eq('order_id', orderId),
          supabase.from('payments').select('*').eq('order_id', orderId)
      ]);
      
      setOrderItemsLoaded(itemsRes.data || []);
      setOrderPaymentsLoaded(payRes.data || []);
      setLoadingItems(false);
  };

  // --- ADICIONAR ACERTO DE PAGAMENTO ---
  const handleAddPayment = async (order) => {
      const amount = Number(newPaymentAmount);
      if (amount <= 0) return;
      setIsSubmitting(true);
      try {
          await supabase.from('payments').insert([{
              order_id: order.id,
              amount: amount,
              method: newPaymentMethod,
              status: 'approved',
              description: `Acerto PDV`,
              approved_by: session.user.id,
              approver_name: profile?.full_name || 'Balcão',
              approved_at: new Date().toISOString()
          }]);

          const newPaid = Number(order.paid || 0) + amount;
          await supabase.from('orders').update({ paid: newPaid }).eq('id', order.id);

          const { data: payRes } = await supabase.from('payments').select('*').eq('order_id', order.id);
          setOrderPaymentsLoaded(payRes || []);
          
          setNewPaymentAmount('');
          setShowPaymentForm(false);
          refreshData();
      } catch (error) {
          alert('Erro ao registrar pagamento.');
      } finally {
          setIsSubmitting(false);
      }
  };

  // --- EXCLUSÕES COM PIN (PEDIDO OU PAGAMENTO) ---
  const requestPinAction = (type, payload) => {
      setPinAction({ type, payload });
      setAdminPin('');
      setPinError('');
      setShowPinModal(true);
  };

  const executePinAction = async () => {
      if (!adminPin) return;
      setIsSubmitting(true);
      setPinError('');

      try {
          const { data: adminData, error: authError } = await supabase
              .from('profiles')
              .select('id')
              .eq('role', 'admin')
              .eq('pin', adminPin)
              .single();

          if (authError || !adminData) {
              setPinError('Senha administrativa incorreta.');
              setIsSubmitting(false);
              return;
          }

          if (pinAction.type === 'order') {
              const orderToCancel = pinAction.payload;
              const { data: items } = await supabase.from('order_items').select('*').eq('order_id', orderToCancel.id);
              const { error: rpcError } = await supabase.rpc('delete_order_with_pin', {
                  p_order_id: orderToCancel.id,
                  p_admin_pin: adminPin
              });
              if (rpcError) throw new Error(rpcError.message);

              if (items) {
                  for (const item of items) {
                      const prod = products.find(p => p.id === item.product_id);
                      if (prod) {
                          await supabase.from('products').update({ stock: prod.stock + item.qty }).eq('id', prod.id);
                      }
                  }
              }
              alert('Pedido excluído e estoque estornado.');
              setExpandedOrder(null);
          } 
          else if (pinAction.type === 'payment') {
              const paymentToDelete = pinAction.payload;
              const orderId = paymentToDelete.order_id;
              
              await supabase.from('payments').delete().eq('id', paymentToDelete.id);
              
              const order = orders.find(o => o.id === orderId);
              const newPaid = Math.max(0, (order?.paid || 0) - paymentToDelete.amount);
              await supabase.from('orders').update({ paid: newPaid }).eq('id', orderId);

              setOrderPaymentsLoaded(prev => prev.filter(p => p.id !== paymentToDelete.id));
              alert('Pagamento estornado com sucesso.');
          }

          refreshData();
          setShowPinModal(false);
          setPinAction({ type: null, payload: null });

      } catch (error) {
          console.error(error);
          setPinError(error.message.includes('inválida') ? 'Senha incorreta.' : 'Erro de permissão no banco.');
      } finally {
          setIsSubmitting(false);
      }
  };

  // --- LOGOUT SEGURO ---
  const handleLogout = async () => {
      if (todayBalance.pendente > 0) {
          alert(`Operação bloqueada.\nVocê não pode fechar o caixa com pagamentos pendentes hoje.\nRestam receber: ${formatBRL(todayBalance.pendente)}`);
          return;
      }
      await supabase.auth.signOut();
  };

  const handlePrint = async (orderData) => {
      let itemsToPrint = orderData.order_items;
      if (!itemsToPrint || itemsToPrint.length === 0) {
          const { data } = await supabase.from('order_items').select('*').eq('order_id', orderData.id);
          itemsToPrint = data || [];
      }

      const isDelivery = orderData.metadata?.order_type === 'delivery';
      const custInfo = orderData.metadata?.customer_info;
      const html = pdvTemplate({ order: orderData, items: itemsToPrint, customerInfo: custInfo, isDelivery });
      executePrint(html);
  };

  const resetPOS = () => {
      setCart([]);
      setCustomer({ name: '', phone: '', cep: '', street: '', number: '', neighborhood: '', complement: '' });
      setSearch('');
      setCashReceived('');
      setShowMobileCart(false);
      setSuccessOrder(null);
  };

  if (successOrder) {
      return (
          <div className="h-screen w-full flex items-center justify-center bg-slate-50 p-6 animate-in fade-in">
              <div className="bg-white p-8 rounded-[3rem] shadow-2xl max-w-md w-full text-center space-y-6">
                  <div className="w-24 h-24 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto">
                      <CheckCircle2 size={48} />
                  </div>
                  <div>
                      <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tighter">Pedido Finalizado</h2>
                      <p className="font-bold text-slate-400 mt-2">OS: #{successOrder.id.slice(0,6).toUpperCase()}</p>
                      {successOrder.metadata?.change_amount > 0 && (
                          <p className="mt-4 text-lg font-black text-slate-800 bg-slate-100 p-3 rounded-2xl border border-slate-200">
                              Troco do Cliente: <span className="text-green-600 block text-2xl mt-1">{formatBRL(successOrder.metadata.change_amount)}</span>
                          </p>
                      )}
                  </div>
                  <div className="flex gap-3">
                      <button onClick={() => handlePrint(successOrder)} className="flex-1 py-4 bg-slate-100 text-slate-700 rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-2 active:scale-95">
                          <Printer size={18}/> Imprimir Via
                      </button>
                      <button onClick={resetPOS} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs active:scale-95 shadow-lg shadow-indigo-200">
                          Novo Pedido
                      </button>
                  </div>
              </div>
          </div>
      );
  }

  return (
    <div className="flex flex-col md:flex-row h-screen bg-slate-100 overflow-hidden font-bold">
      
      {/* MODAL DE SENHA ADMIN */}
      {showPinModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-6 shadow-2xl space-y-4">
                  <div className="flex items-center gap-3 text-red-500 mb-2">
                      <Lock size={24} />
                      <h3 className="text-lg font-black uppercase">Autorização Admin</h3>
                  </div>
                  <p className="text-xs font-bold text-slate-500 leading-tight">
                      Digite a senha de administrador para autorizar a exclusão {pinAction.type === 'order' ? 'do pedido' : 'do pagamento'}.
                  </p>
                  
                  <input 
                      type="password" 
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-center text-2xl font-black tracking-[0.5em] outline-none focus:border-red-400" 
                      placeholder="****" 
                      maxLength={6}
                      value={adminPin}
                      onChange={e => setAdminPin(e.target.value)}
                      autoFocus
                  />
                  
                  {pinError && <p className="text-[10px] text-red-500 font-bold text-center">{pinError}</p>}
                  
                  <div className="flex gap-2 pt-2">
                      <button onClick={() => setShowPinModal(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl text-xs font-black uppercase">Cancelar</button>
                      <button onClick={executePinAction} disabled={isSubmitting || !adminPin} className="flex-1 py-3 bg-red-500 text-white rounded-xl text-xs font-black uppercase flex justify-center items-center gap-2 disabled:opacity-50">
                          {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : 'Confirmar'}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* LADO ESQUERDO: ÁREA PRINCIPAL */}
      <div className="flex-1 flex flex-col h-full relative z-0">
          
          <div className="bg-white p-4 shadow-sm z-10 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                  {isAdmin && (
                      <button onClick={() => navigate('/')} className="p-3 bg-slate-50 rounded-2xl active:scale-90 text-slate-600" title="Voltar ao Painel">
                          <ArrowLeft size={20}/>
                      </button>
                  )}
                  <div>
                      <p className="text-xs font-black text-slate-800 uppercase leading-none">PDV Balcão</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{profile?.full_name || 'Caixa'}</p>
                  </div>
              </div>
              
              <div className="flex bg-slate-100 p-1 rounded-xl flex-1 max-w-sm mx-4 hidden md:flex">
                  <button onClick={() => setActiveTab('pdv')} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${activeTab === 'pdv' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}>Caixa Aberto</button>
                  <button onClick={() => setActiveTab('history')} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${activeTab === 'history' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}>Histórico</button>
                  <button onClick={() => setActiveTab('balance')} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${activeTab === 'balance' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}>Balanço</button>
              </div>

              <button onClick={handleLogout} className="p-3 bg-red-50 text-red-600 rounded-2xl active:scale-90 font-black text-[10px] uppercase flex items-center gap-2">
                  <LogOut size={16}/> <span className="hidden sm:inline">Fechar Caixa</span>
              </button>
          </div>

          <div className="md:hidden flex bg-slate-100 p-1 m-4 rounded-xl shrink-0">
              <button onClick={() => setActiveTab('pdv')} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${activeTab === 'pdv' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}>PDV</button>
              <button onClick={() => setActiveTab('history')} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${activeTab === 'history' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}>Histórico</button>
              <button onClick={() => setActiveTab('balance')} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${activeTab === 'balance' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}>Balanço</button>
          </div>

          {activeTab === 'pdv' && (
              <>
                  <div className="px-4 pb-2 bg-slate-100 shrink-0">
                      <div className="relative">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                          <input 
                              className="w-full pl-12 pr-4 py-4 bg-white rounded-2xl text-sm outline-none shadow-sm focus:border-indigo-300 transition-colors" 
                              placeholder="Buscar produto por nome..." 
                              value={search} 
                              onChange={e => setSearch(e.target.value)} 
                          />
                      </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 pb-24 md:pb-6">
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                          {filteredProducts.map(p => (
                              <button 
                                  key={p.id} 
                                  onClick={() => addToCart(p)}
                                  className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-200 active:scale-95 transition-all text-left flex flex-col h-full"
                              >
                                  <div className="flex-1">
                                      <p className="font-black text-slate-800 text-sm leading-tight">{p.name}</p>
                                      <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold">Estoque: {p.stock}</p>
                                  </div>
                                  <p className="text-indigo-600 font-black font-mono text-lg mt-3">{formatBRL(p.price)}</p>
                              </button>
                          ))}
                      </div>
                  </div>
              </>
          )}

          {activeTab === 'history' && (
              <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50 space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
                      <h2 className="text-sm font-black text-slate-800 uppercase flex items-center gap-2"><History size={18}/> Consultar Pedidos</h2>
                      
                      {/* Filtros de Histórico */}
                      <div className="flex items-center gap-2 bg-white p-1 rounded-xl shadow-sm border border-slate-200">
                          <button onClick={() => setHistoryFilter('day')} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase ${historyFilter === 'day' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400'}`}>Dia</button>
                          <button onClick={() => setHistoryFilter('month')} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase ${historyFilter === 'month' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400'}`}>Mês</button>
                          <button onClick={() => setHistoryFilter('all')} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase ${historyFilter === 'all' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400'}`}>Tudo</button>
                          
                          <div className="h-4 w-px bg-slate-200 mx-1"></div>
                          
                          {historyFilter === 'day' && <input type="date" className="text-xs font-bold text-slate-600 outline-none bg-transparent" value={filterDate} onChange={e => setFilterDate(e.target.value)}/>}
                          {historyFilter === 'month' && <input type="month" className="text-xs font-bold text-slate-600 outline-none bg-transparent" value={filterMonth} onChange={e => setFilterMonth(e.target.value)}/>}
                      </div>
                  </div>

                  {displayedHistory.length === 0 && <p className="text-center text-slate-400 text-xs py-8">Nenhum pedido encontrado neste período.</p>}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {displayedHistory.map(order => {
                          const isExpanded = expandedOrder === order.id;
                          const pendingAmount = Math.max(0, order.total - (order.paid || 0));
                          
                          return (
                          <div key={order.id} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200 flex flex-col gap-3 transition-all">
                              <div className="flex justify-between items-start">
                                  <div>
                                      <div className="flex items-center gap-2 mb-1">
                                          <span className={`text-[9px] font-black uppercase px-2 py-1 rounded ${order.metadata?.order_type === 'delivery' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-700'}`}>
                                              {order.metadata?.order_type || 'Balcão'}
                                          </span>
                                          <span className="text-xs font-bold text-slate-400">{new Date(order.created_at).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}</span>
                                      </div>
                                      <p className="font-black text-slate-800 text-sm">{order.metadata?.customer_info?.name || 'Cliente'}</p>
                                      
                                      <div className="mt-1">
                                          <p className="font-mono text-indigo-600 font-black text-lg">{formatBRL(order.total)}</p>
                                          {pendingAmount > 0 ? (
                                              <p className="text-[10px] text-orange-500 font-bold uppercase mt-0.5">Falta: {formatBRL(pendingAmount)}</p>
                                          ) : (
                                              <p className="text-[10px] text-green-500 font-bold uppercase mt-0.5">Pago</p>
                                          )}
                                      </div>
                                  </div>
                                  
                                  <div className="flex flex-col gap-2">
                                      <button onClick={() => handlePrint(order)} className="p-2 bg-indigo-50 text-indigo-600 rounded-xl active:scale-90 shadow-sm" title="Imprimir Recibo">
                                          <Printer size={18}/>
                                      </button>
                                      <button onClick={() => requestPinAction('order', order)} className="p-2 bg-red-50 text-red-600 rounded-xl active:scale-90 shadow-sm" title="Excluir Pedido">
                                          <Trash2 size={18}/>
                                      </button>
                                  </div>
                              </div>

                              <div className="pt-2 border-t border-slate-100">
                                  <button onClick={() => toggleOrderDetails(order.id)} className="w-full flex justify-between items-center text-[10px] font-black text-slate-400 uppercase py-2">
                                      Detalhes e Pagamentos
                                      {isExpanded ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                                  </button>
                                  
                                  {isExpanded && (
                                      <div className="mt-2 space-y-4 animate-in fade-in pb-2">
                                          {loadingItems ? (
                                              <p className="text-xs text-slate-400 text-center py-2">Carregando...</p>
                                          ) : (
                                              <>
                                                  {/* SESSÃO DE ITENS */}
                                                  <div className="bg-slate-50 p-3 rounded-xl">
                                                      <p className="text-[9px] font-black uppercase text-slate-400 mb-2 border-b border-slate-200 pb-1">Produtos</p>
                                                      {orderItemsLoaded.map(item => (
                                                          <div key={item.id} className="flex justify-between text-xs text-slate-600 mb-1">
                                                              <span>{item.qty}x {item.name}</span>
                                                              <span className="font-mono font-bold">{formatBRL(item.price * item.qty)}</span>
                                                          </div>
                                                      ))}
                                                  </div>

                                                  {/* SESSÃO DE PAGAMENTOS */}
                                                  <div className="bg-slate-50 p-3 rounded-xl">
                                                      <p className="text-[9px] font-black uppercase text-slate-400 mb-2 border-b border-slate-200 pb-1">Pagamentos Efetuados</p>
                                                      {orderPaymentsLoaded.length > 0 ? orderPaymentsLoaded.map(pay => (
                                                          <div key={pay.id} className="flex justify-between items-center text-xs text-slate-600 mb-1.5 bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
                                                              <div>
                                                                  <span className="font-bold text-slate-700 block">{pay.method}</span>
                                                                  <span className="text-[9px] text-slate-400">{new Date(pay.created_at).toLocaleDateString('pt-BR')}</span>
                                                              </div>
                                                              <div className="flex items-center gap-2">
                                                                  <span className="font-mono font-black text-green-600">{formatBRL(pay.amount)}</span>
                                                                  <button onClick={() => requestPinAction('payment', pay)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={12}/></button>
                                                              </div>
                                                          </div>
                                                      )) : <p className="text-[10px] text-slate-400">Nenhum pagamento registrado.</p>}
                                                      
                                                      {/* Adicionar Pagamento (Se pendente) */}
                                                      {pendingAmount > 0 && !showPaymentForm && (
                                                          <button onClick={() => {setShowPaymentForm(true); setNewPaymentAmount(pendingAmount);}} className="w-full mt-2 py-2 bg-indigo-100 text-indigo-700 text-[10px] font-black uppercase rounded-lg">
                                                              + Receber Acerto
                                                          </button>
                                                      )}

                                                      {showPaymentForm && (
                                                          <div className="mt-2 p-2 bg-white rounded-lg border border-indigo-100 space-y-2">
                                                              <div className="grid grid-cols-2 gap-2">
                                                                  <select className="p-2 bg-slate-50 rounded-lg text-xs font-bold outline-none" value={newPaymentMethod} onChange={e=>setNewPaymentMethod(e.target.value)}>
                                                                      <option>Dinheiro</option><option>Pix</option><option>Cartão</option>
                                                                  </select>
                                                                  <input type="number" className="p-2 bg-slate-50 rounded-lg text-xs font-bold outline-none" value={newPaymentAmount} onChange={e=>setNewPaymentAmount(e.target.value)} placeholder="Valor"/>
                                                              </div>
                                                              <div className="flex gap-2">
                                                                  <button onClick={() => setShowPaymentForm(false)} className="flex-1 py-1.5 text-[10px] font-black uppercase text-slate-400 bg-slate-100 rounded-lg">Cancelar</button>
                                                                  <button onClick={() => handleAddPayment(order)} disabled={isSubmitting} className="flex-1 py-1.5 text-[10px] font-black uppercase text-white bg-green-500 rounded-lg flex justify-center items-center">
                                                                      {isSubmitting ? <Loader2 size={12} className="animate-spin"/> : 'Confirmar'}
                                                                  </button>
                                                              </div>
                                                          </div>
                                                      )}
                                                  </div>
                                              </>
                                          )}
                                      </div>
                                  )}
                              </div>
                          </div>
                      )})}
                  </div>
              </div>
          )}

          {activeTab === 'balance' && (
              <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50">
                  <div className="max-w-xl mx-auto space-y-6">
                      <div className="flex items-center gap-3 mb-6">
                          <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl"><Calculator size={24}/></div>
                          <div>
                              <h2 className="text-lg font-black text-slate-800 uppercase leading-tight">Fechamento de Caixa</h2>
                              <p className="text-xs font-bold text-slate-400">Resumo de operações realizadas hoje</p>
                          </div>
                      </div>

                      <div className="bg-slate-900 text-white p-6 rounded-[2.5rem] shadow-xl relative overflow-hidden">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Total de Vendas (Dia)</p>
                          <p className="text-4xl font-black font-mono">{formatBRL(todayBalance.total)}</p>
                      </div>

                      <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-4">
                          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Recebimentos Realizados</h3>
                          
                          <div className="flex justify-between items-center p-3 bg-slate-50 rounded-2xl">
                              <div className="flex items-center gap-2 text-slate-600"><Banknote size={18}/> <span className="font-bold text-sm">Dinheiro</span></div>
                              <span className="font-mono font-black text-indigo-600">{formatBRL(todayBalance['Dinheiro'])}</span>
                          </div>
                          
                          <div className="flex justify-between items-center p-3 bg-slate-50 rounded-2xl">
                              <div className="flex items-center gap-2 text-slate-600"><QrCode size={18}/> <span className="font-bold text-sm">Pix</span></div>
                              <span className="font-mono font-black text-indigo-600">{formatBRL(todayBalance['Pix'])}</span>
                          </div>
                          
                          <div className="flex justify-between items-center p-3 bg-slate-50 rounded-2xl">
                              <div className="flex items-center gap-2 text-slate-600"><CreditCard size={18}/> <span className="font-bold text-sm">Cartão</span></div>
                              <span className="font-mono font-black text-indigo-600">{formatBRL(todayBalance['Cartão'])}</span>
                          </div>

                          <div className="pt-4 border-t border-slate-100 flex justify-between items-center px-2">
                              <div className="flex items-center gap-2 text-orange-500">
                                  <ListFilter size={18} /> <span className="text-xs font-black uppercase">Falta Receber Hoje</span>
                              </div>
                              <span className="font-mono font-black text-orange-500">{formatBRL(todayBalance.pendente)}</span>
                          </div>
                          {todayBalance.pendente > 0 && (
                              <p className="text-[9px] text-center text-orange-400 mt-2 font-bold bg-orange-50 p-2 rounded-lg">
                                  Atenção: Você precisa receber ou justificar os saldos pendentes antes de fechar o caixa.
                              </p>
                          )}
                      </div>
                  </div>
              </div>
          )}

          {/* Botão Flutuante Carrinho (MOBILE) */}
          {activeTab === 'pdv' && (
              <div className="md:hidden absolute bottom-4 left-4 right-4 z-20">
                  <button onClick={() => setShowMobileCart(true)} className="w-full bg-indigo-600 text-white p-4 rounded-2xl shadow-xl flex justify-between items-center active:scale-95 transition-transform">
                      <div className="flex items-center gap-2">
                          <div className="bg-white/20 p-2 rounded-lg relative">
                              <ShoppingCart size={20} />
                              {cartItemsCount > 0 && <span className="absolute -top-2 -right-2 bg-yellow-400 text-slate-900 w-5 h-5 rounded-full text-[10px] flex items-center justify-center border-2 border-indigo-600">{cartItemsCount}</span>}
                          </div>
                          <span className="uppercase text-xs font-black">Ver Carrinho</span>
                      </div>
                      <span className="font-mono text-lg">{formatBRL(cartTotal)}</span>
                  </button>
              </div>
          )}
      </div>

      {/* LADO DIREITO: CHECKOUT */}
      <div className={`
          fixed md:relative inset-0 md:inset-auto z-50 md:z-10
          w-full md:w-[380px] lg:w-[420px] flex-shrink-0 bg-white flex flex-col h-full shadow-2xl md:shadow-[-10px_0_30px_rgba(0,0,0,0.05)] border-l border-slate-200
          transition-transform duration-300 ease-in-out
          ${showMobileCart ? 'translate-y-0' : 'translate-y-full md:translate-y-0'}
      `}>
          
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white shadow-sm z-10">
              <h2 className="text-lg font-black text-slate-800 uppercase tracking-tighter">Carrinho</h2>
              <button onClick={() => setShowMobileCart(false)} className="md:hidden p-2 bg-slate-100 rounded-full active:scale-90"><X size={20}/></button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
              {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-2 opacity-50">
                      <ShoppingCart size={48} />
                      <p className="uppercase text-xs font-black">Carrinho Vazio</p>
                  </div>
              ) : (
                  cart.map(item => (
                      <div key={item.id} className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                              <p className="font-bold text-slate-800 text-xs truncate">{item.name}</p>
                              <p className="font-mono text-indigo-600 font-black text-sm">{formatBRL(item.price * item.qty)}</p>
                          </div>
                          <div className="flex items-center gap-3 bg-slate-50 p-1.5 rounded-xl border border-slate-100">
                              <button onClick={() => updateQty(item.id, -1)} className="w-8 h-8 bg-white rounded-lg shadow-sm flex items-center justify-center text-slate-600 active:scale-90"><Minus size={14}/></button>
                              <span className="font-black text-sm w-4 text-center">{item.qty}</span>
                              <button onClick={() => updateQty(item.id, 1)} className="w-8 h-8 bg-slate-800 text-white rounded-lg shadow-sm flex items-center justify-center active:scale-90"><Plus size={14}/></button>
                          </div>
                      </div>
                  ))
              )}
          </div>

          {cart.length > 0 && (
              <div className="bg-white border-t border-slate-100 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] p-4 space-y-4 overflow-y-auto max-h-[60vh] md:max-h-none z-20">
                  
                  <div className="flex bg-slate-100 p-1 rounded-2xl">
                      <button onClick={() => setOrderType('balcao')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 transition-all ${orderType === 'balcao' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400'}`}>
                          <Store size={16}/> Balcão
                      </button>
                      <button onClick={() => setOrderType('delivery')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 transition-all ${orderType === 'delivery' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400'}`}>
                          <Bike size={16}/> Delivery
                      </button>
                  </div>

                  <div className="space-y-2 bg-slate-50 p-3 rounded-3xl border border-slate-100">
                      <div className="flex items-center gap-2 text-indigo-600 mb-1">
                          <User size={14} /> <span className="text-[10px] font-black uppercase tracking-widest">Cliente</span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2">
                          <input className="col-span-2 w-full p-2.5 bg-white rounded-xl text-xs font-bold outline-none border border-slate-200 focus:border-indigo-400" placeholder="Nome (Obrigatório P/ Entrega)" value={customer.name} onChange={e => setCustomer({...customer, name: e.target.value})} />
                          <input className="w-full p-2.5 bg-white rounded-xl text-xs font-bold outline-none border border-slate-200 focus:border-indigo-400" placeholder="Telefone" value={customer.phone} onChange={e => setCustomer({...customer, phone: e.target.value})} />
                          <input className="w-full p-2.5 bg-white rounded-xl text-xs font-bold outline-none border border-slate-200 focus:border-indigo-400" placeholder="CEP" maxLength={9} value={customer.cep} onChange={handleCepChange} />
                      </div>

                      {orderType === 'delivery' && (
                          <div className="grid grid-cols-3 gap-2 animate-in slide-in-from-top-2 pt-2 mt-2 border-t border-slate-200">
                              <input className="col-span-2 w-full p-2.5 bg-white rounded-xl text-xs font-bold outline-none border border-slate-200 focus:border-indigo-400" placeholder="Rua / Avenida" value={customer.street} onChange={e => setCustomer({...customer, street: e.target.value})} />
                              <input className="w-full p-2.5 bg-white rounded-xl text-xs font-bold outline-none border border-slate-200 focus:border-indigo-400" placeholder="Num" value={customer.number} onChange={e => setCustomer({...customer, number: e.target.value})} />
                              <input className="col-span-3 w-full p-2.5 bg-white rounded-xl text-xs font-bold outline-none border border-slate-200 focus:border-indigo-400" placeholder="Bairro" value={customer.neighborhood} onChange={e => setCustomer({...customer, neighborhood: e.target.value})} />
                          </div>
                      )}
                  </div>

                  <div className="space-y-2">
                      <div className="flex bg-slate-100 p-1 rounded-xl">
                          <button onClick={() => setPaymentStatus('paid')} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${paymentStatus === 'paid' ? 'bg-green-500 text-white shadow-sm' : 'text-slate-400'}`}>Pago</button>
                          <button onClick={() => setPaymentStatus('pending')} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${paymentStatus === 'pending' ? 'bg-orange-400 text-white shadow-sm' : 'text-slate-400'}`}>Pagar Depois</button>
                      </div>

                      {paymentStatus === 'paid' && (
                          <div className="grid grid-cols-3 gap-2 animate-in fade-in">
                              {['Dinheiro', 'Pix', 'Cartão'].map(m => (
                                  <button 
                                      key={m} 
                                      onClick={() => setPaymentMethod(m)} 
                                      className={`py-2 rounded-xl border-2 flex flex-col items-center gap-1 transition-all ${paymentMethod === m ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-100 bg-white text-slate-400'}`}
                                  >
                                      {m === 'Dinheiro' ? <Banknote size={14}/> : m === 'Pix' ? <QrCode size={14}/> : <CreditCard size={14}/>}
                                      <span className="text-[9px] font-black uppercase">{m}</span>
                                  </button>
                              ))}
                          </div>
                      )}

                      {paymentMethod === 'Dinheiro' && paymentStatus === 'paid' && (
                          <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 animate-in slide-in-from-top-2 mt-2">
                              <div className="flex-1">
                                  <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">Valor Recebido</label>
                                  <input 
                                      type="number" 
                                      className="w-full p-2 bg-white rounded-lg text-sm font-bold outline-none border border-slate-200 focus:border-green-400" 
                                      placeholder="R$ 0,00" 
                                      value={cashReceived} 
                                      onChange={e => setCashReceived(e.target.value)} 
                                  />
                              </div>
                              <div className="flex-1 text-right">
                                  <span className="text-[9px] font-black uppercase text-slate-400 block mb-1">Troco</span>
                                  <span className={`text-lg font-black font-mono ${changeAmount > 0 ? 'text-green-600' : 'text-slate-400'}`}>
                                      {formatBRL(changeAmount)}
                                  </span>
                              </div>
                          </div>
                      )}
                  </div>

                  <div className="pt-3 mt-1 border-t border-slate-100">
                      <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-black uppercase text-slate-400">Total a Cobrar</span>
                          <span className="text-2xl font-black font-mono text-slate-800">{formatBRL(cartTotal)}</span>
                      </div>
                      <button 
                          onClick={handleCheckout} 
                          disabled={isSubmitting}
                          className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs shadow-xl shadow-indigo-200 active:scale-95 transition-transform flex justify-center items-center gap-2 disabled:opacity-70"
                      >
                          {isSubmitting ? <Loader2 size={18} className="animate-spin"/> : <><CheckCircle2 size={18}/> Concluir Pedido</>}
                      </button>
                  </div>
              </div>
          )}
      </div>

    </div>
  );
};

export default BalcaoPOS;