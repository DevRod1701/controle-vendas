import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ShoppingCart, Plus, Minus, X, User, CreditCard, Banknote, QrCode, Bike, Store, CheckCircle2, Loader2, Printer, History, ArrowLeft, Trash2, LogOut, Lock, ChevronDown, ChevronUp, Calculator, ListFilter, MessageSquare, AlertCircle, MapPin, Clock } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { formatBRL } from '../utils/formatters';
import { executePrint } from '../utils/printHandler';
import { pdvTemplate } from '../utils/print/pdvTemplate';
import AlertModal from '../components/modals/AlertModal';
import ConfirmModal from '../components/modals/ConfirmModal';

// ==============================================================================
// 🏍️ CONFIGURAÇÕES DE FRETE AUTOMÁTICO (DELIVERY)
// ==============================================================================
const DELIVERY_CONFIG = {
    originCep: '03817125', 
    originLat: -23.49138767727177, //-23.49138767727177, -46.49318473636381
    originLon: -46.49318473636381,
    baseDistanceKm: 1.5,   // Distância base alterada para 1.5km
    basePrice: 5.00,       // Preço da distância base
    pricePerExtraKm: 1.00  // Valor por Km adicional
};
// ==============================================================================

const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
};

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
  const { products, orders, customers, refreshData } = useData();
  const { session, profile, isAdmin } = useAuth();
  
  const [activeTab, setActiveTab] = useState('pdv'); 
  
  const [alertInfo, setAlertInfo] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);

  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [orderType, setOrderType] = useState('balcao'); 
  
  // ESTADOS DE ENCOMENDA
  const [isPreOrder, setIsPreOrder] = useState(false);
  const [downPayment, setDownPayment] = useState('');

  const [deliveryFee, setDeliveryFee] = useState(''); 
  const [isCalculatingFee, setIsCalculatingFee] = useState(false); 
  
  const [editingObsId, setEditingObsId] = useState(null);
  const [tempObs, setTempObs] = useState('');

  const [customer, setCustomer] = useState({ id: null, name: '', phone: '', cpf: '', cep: '', street: '', number: '', neighborhood: '', complement: '' });
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [saveCustomer, setSaveCustomer] = useState(false);
  
  const [cepWarning, setCepWarning] = useState('');
  const [updateAddress, setUpdateAddress] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState('Cartão');
  const [paymentStatus, setPaymentStatus] = useState('paid'); 
  const [cashReceived, setCashReceived] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successOrder, setSuccessOrder] = useState(null);

  const [historyFilter, setHistoryFilter] = useState('day'); 
  const [filterDate, setFilterDate] = useState(getTodayLocal());
  const [filterMonth, setFilterMonth] = useState(getMonthLocal());
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [orderItemsLoaded, setOrderItemsLoaded] = useState([]);
  const [orderPaymentsLoaded, setOrderPaymentsLoaded] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [newPaymentAmount, setNewPaymentAmount] = useState('');
  const [newPaymentMethod, setNewPaymentMethod] = useState('Dinheiro');

  const [showPinModal, setShowPinModal] = useState(false);
  const [adminPin, setAdminPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinAction, setPinAction] = useState({ type: null, payload: null }); 

  // 1. FILTRO DE PRODUTOS: Esconde os que têm estoque <= 0
  const filteredProducts = useMemo(() => {
      let list = products.filter(p => p.stock > 0);
      if (search) {
          list = list.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
      }
      return list;
  }, [products, search]);

  const filteredCustomers = useMemo(() => {
      const term = customerSearch || customer.name;
      if (!term) return [];
      const lower = term.toLowerCase();
      return customers.filter(c => 
          c.name?.toLowerCase().includes(lower) || 
          c.phone?.includes(lower) || 
          c.cpf?.includes(lower)
      ).slice(0, 5); 
  }, [customers, customerSearch, customer.name]);

  const cartTotal = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
  const cartItemsCount = cart.reduce((acc, item) => acc + item.qty, 0);
  
  const finalTotal = orderType === 'delivery' ? cartTotal + Number(deliveryFee || 0) : cartTotal;
  const changeAmount = paymentMethod === 'Dinheiro' && cashReceived ? Math.max(0, Number(cashReceived) - finalTotal) : 0;

  const allPosOrders = useMemo(() => {
      return orders.filter(o => o.metadata && (o.metadata.order_type === 'balcao' || o.metadata.order_type === 'delivery'));
  }, [orders]);

  const displayedHistory = useMemo(() => {
      let filtered = allPosOrders;
      if (historyFilter === 'day') {
          filtered = filtered.filter(o => o.created_at.startsWith(filterDate));
      } else if (historyFilter === 'month') {
          filtered = filtered.filter(o => o.created_at.startsWith(filterMonth));
      }
      return filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [allPosOrders, historyFilter, filterDate, filterMonth]);

  // 3. ATUALIZAÇÃO DO BALANÇO: Separa pendências normais de pendências de encomendas
  const todayBalance = useMemo(() => {
      const todayStr = getTodayLocal();
      const todayOrders = allPosOrders.filter(o => o.created_at.startsWith(todayStr));
      const totals = { total: 0, Dinheiro: 0, Pix: 0, Cartão: 0, pendente: 0, pendente_encomenda: 0 };
      
      todayOrders.forEach(o => {
          totals.total += Number(o.total);
          const paid = Number(o.paid || 0);
          const total = Number(o.total || 0);
          const debt = Math.max(0, total - paid);
          
          if (o.metadata?.is_pre_order) {
              totals.pendente_encomenda += debt;
          } else {
              totals.pendente += debt;
          }
          
          if (paid > 0) {
              const method = o.payment_method || 'Dinheiro';
              if (totals[method] !== undefined) totals[method] += paid;
          }
      });
      return totals;
  }, [allPosOrders]);

  // --- CARRINHO COM TRAVA DE ESTOQUE ---
  const addToCart = (product) => {
      setCart(prev => {
          const exists = prev.find(i => i.id === product.id && !i.observation); 
          const currentQty = exists ? exists.qty : 0;
          
          if (currentQty >= product.stock) {
              setAlertInfo({ type: 'error', title: 'Estoque Insuficiente', message: `O estoque máximo deste item é ${product.stock} un.`});
              return prev;
          }

          if (exists) return prev.map(i => i.id === product.id && !i.observation ? { ...i, qty: i.qty + 1 } : i);
          
          const cartItemId = `${product.id}-${Date.now()}`;
          return [...prev, { ...product, cartItemId, qty: 1, observation: '' }];
      });
  };

  const updateQty = (cartItemId, delta) => {
      setCart(prev => {
          const itemToUpdate = prev.find(i => i.cartItemId === cartItemId);
          if (!itemToUpdate) return prev;

          const newQty = itemToUpdate.qty + delta;
          
          if (delta > 0 && newQty > itemToUpdate.stock) {
              setAlertInfo({ type: 'error', title: 'Estoque Insuficiente', message: `Estoque máximo atingido (${itemToUpdate.stock} un).`});
              return prev;
          }

          return prev.map(item => {
              if (item.cartItemId === cartItemId) {
                  return { ...item, qty: newQty };
              }
              return item;
          }).filter(item => item.qty > 0);
      });
  };

  const saveObservation = (cartItemId) => {
      setCart(prev => prev.map(item => item.cartItemId === cartItemId ? { ...item, observation: tempObs } : item));
      setEditingObsId(null);
      setTempObs('');
  };

  const handleSelectCustomer = (c) => {
      setCustomer({
          id: c.id,
          name: c.name || '',
          phone: c.phone || '',
          cpf: c.cpf || '',
          cep: c.cep || '',
          street: c.street || '',
          number: c.number || '',
          neighborhood: c.neighborhood || '',
          complement: c.complement || '' 
      });
      setCustomerSearch(''); 
      setShowCustomerDropdown(false);
      setCepWarning('');
      setUpdateAddress(false); 
      
      // Gatilho Automático: Se puxou do banco e já tem rua, calcula o frete!
      if (c.cep && c.street) {
          calculateAutoDeliveryFee({
              logradouro: c.street,
              bairro: c.neighborhood,
              localidade: 'São Paulo', // Fallback assumindo sua região base
              uf: 'SP'
          });
      } else {
          setDeliveryFee(''); 
      }
  };

  const calculateAutoDeliveryFee = async (addressData) => {
      setIsCalculatingFee(true);
      try {
          const city = addressData.localidade || 'São Paulo';
          const state = addressData.uf || 'SP';
          
          // 1ª Tentativa: Busca pela Rua exata
          const streetQuery = `${addressData.logradouro}, ${city}, ${state}, Brazil`;
          let destRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(streetQuery)}&format=json&limit=1`);
          let destData = await destRes.json();
          
          // 2ª Tentativa (Opcional): Se falhou na rua, busca pelo Bairro para dar uma estimativa
          if (!destData || destData.length === 0) {
              const neighborhoodQuery = `${addressData.bairro}, ${city}, ${state}, Brazil`;
              destRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(neighborhoodQuery)}&format=json&limit=1`);
              destData = await destRes.json();
          }

          if (!destData || destData.length === 0) {
              setCepWarning('⚠️ Coordenadas não encontradas. Insira o frete manualmente.');
              setIsCalculatingFee(false);
              return;
          }

          const destLat = parseFloat(destData[0].lat);
          const destLon = parseFloat(destData[0].lon);

          const distanceKm = calculateDistance(DELIVERY_CONFIG.originLat, DELIVERY_CONFIG.originLon, destLat, destLon);
          const realisticDistance = distanceKm * 1.3;

          let fee = DELIVERY_CONFIG.basePrice;
          if (realisticDistance > DELIVERY_CONFIG.baseDistanceKm) {
              const extraKm = Math.ceil(realisticDistance - DELIVERY_CONFIG.baseDistanceKm);
              fee += (extraKm * DELIVERY_CONFIG.pricePerExtraKm);
          }

          setDeliveryFee(fee.toFixed(2));
          setCepWarning(`✅ Distância est.: ${realisticDistance.toFixed(1)}km | Frete automático aplicado.`);

      } catch (err) {
          console.error("Erro no cálculo automátio de frete", err);
          setCepWarning('⚠️ Erro ao calcular. Insira o frete manualmente.');
      } finally {
          setIsCalculatingFee(false);
      }
  };

  const handleCepChange = async (e) => {
      let val = e.target.value.replace(/\D/g, '').slice(0, 8);
      
      let formattedVal = val;
      if (val.length > 5) {
          formattedVal = val.replace(/^(\d{5})(\d)/, "$1-$2");
      }

      setCustomer(prev => ({ ...prev, cep: formattedVal }));
      setCepWarning('');

      if (val.length === 8) {
          try {
              const res = await fetch(`https://viacep.com.br/ws/${val}/json/`);
              const data = await res.json();
              if (data.erro) {
                  setCepWarning('⚠️ CEP não encontrado. Preencha o endereço manualmente.');
                  setDeliveryFee(''); 
              } else {
                  setCustomer(prev => ({ 
                      ...prev, 
                      street: data.logradouro || '', 
                      neighborhood: data.bairro || '',
                      complement: data.complemento || prev.complement 
                  }));
                  calculateAutoDeliveryFee(data);
              }
          } catch (err) {
              setCepWarning('⚠️ Erro na busca do CEP. Preencha manualmente.');
          }
      }
  };

  const handleCheckout = async () => {
      if (cart.length === 0) return;
      if (orderType === 'delivery' && (!customer.name || !customer.street || !customer.number)) {
          setAlertInfo({ type: 'error', title: 'Dados Incompletos', message: 'Preencha o Nome, Rua e Número para finalizar a entrega.' });
          return;
      }
      
      const finalCustomerName = customer.name.trim() || "Cliente Balcão";
      setIsSubmitting(true);

      // Determina o valor pago na hora baseado se é encomenda (sinal) ou venda normal
      let paidAmount = 0;
      if (isPreOrder) {
          paidAmount = Math.min(finalTotal, Number(downPayment || 0));
      } else if (paymentStatus === 'paid') {
          paidAmount = finalTotal;
      }

      const metadata = {
          order_type: orderType,
          customer_info: { ...customer, name: finalCustomerName },
          payment_status: isPreOrder && paidAmount < finalTotal ? 'partial' : paymentStatus,
          cash_received: (!isPreOrder && paymentMethod === 'Dinheiro' && paymentStatus === 'paid') ? Number(cashReceived) : 0,
          change_amount: !isPreOrder ? changeAmount : 0,
          delivery_fee: orderType === 'delivery' ? Number(deliveryFee || 0) : 0,
          is_pre_order: isPreOrder // Tag que marca se foi encomenda
      };

      try {
          if (customer.id) {
              const updateData = { phone: customer.phone, cpf: customer.cpf };
              if (orderType === 'delivery' && updateAddress) {
                  updateData.cep = customer.cep;
                  updateData.street = customer.street;
                  updateData.number = customer.number;
                  updateData.neighborhood = customer.neighborhood;
                  updateData.complement = customer.complement;
              }
              await supabase.from('customers').update(updateData).eq('id', customer.id);
          } 
          else if (saveCustomer && customer.name) {
              const exists = customers.find(c => 
                  (c.phone && c.phone === customer.phone) || 
                  (c.cpf && c.cpf === customer.cpf) || 
                  (c.name.toLowerCase() === customer.name.toLowerCase())
              );
              if (!exists) {
                  await supabase.from('customers').insert([{
                      seller_id: session.user.id,
                      name: customer.name,
                      phone: customer.phone,
                      cpf: customer.cpf,
                      cep: customer.cep,
                      street: customer.street,
                      number: customer.number,
                      neighborhood: customer.neighborhood,
                      complement: customer.complement
                  }]);
              }
          }

          const { data: newOrder, error: orderError } = await supabase.from('orders').insert([{
              seller_id: session.user.id,
              seller_name: profile?.full_name || 'Balcão',
              status: 'approved',
              total: finalTotal,
              paid: paidAmount, // Registra apenas o que foi pago (Sinal ou Total)
              type: 'sale',
              payment_method: paymentMethod,
              metadata: metadata
          }]).select().single();

          if (orderError) throw orderError;

          const itemsToInsert = cart.map(item => ({
              order_id: newOrder.id,
              product_id: item.id,
              name: item.observation ? `${item.name} (Obs: ${item.observation})` : item.name,
              qty: item.qty,
              price: item.price
          }));
          await supabase.from('order_items').insert(itemsToInsert);

          for (const item of cart) {
              await supabase.from('products').update({ stock: item.stock - item.qty }).eq('id', item.id);
          }

          // Só lança no caixa o valor que realmente foi recebido
          if (paidAmount > 0) {
              await supabase.from('payments').insert([{
                  order_id: newOrder.id,
                  amount: paidAmount,
                  method: paymentMethod,
                  status: 'approved',
                  description: isPreOrder ? `Sinal de Encomenda - ${orderType.toUpperCase()}` : `Venda PDV - ${orderType.toUpperCase()}`,
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
          setAlertInfo({ type: 'error', title: 'Erro de Comunicação', message: 'Houve um erro ao registrar o pedido no banco de dados.' });
      } finally {
          setIsSubmitting(false);
      }
  };

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
          setAlertInfo({ type: 'error', title: 'Erro de Conexão', message: 'Não foi possível registrar este pagamento.' });
      } finally {
          setIsSubmitting(false);
      }
  };

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
              setPinError('Senha incorreta.');
              setIsSubmitting(false);
              return;
          }

          if (pinAction.type === 'order') {
              const orderToCancel = pinAction.payload;
              const { data: items } = await supabase.from('order_items').select('*').eq('order_id', orderToCancel.id);
              const { error: rpcError } = await supabase.rpc('delete_order_with_pin', { p_order_id: orderToCancel.id, p_admin_pin: adminPin });
              if (rpcError) throw new Error(rpcError.message);

              if (items) {
                  for (const item of items) {
                      const prod = products.find(p => p.id === item.product_id);
                      if (prod) await supabase.from('products').update({ stock: prod.stock + item.qty }).eq('id', prod.id);
                  }
              }
              setAlertInfo({ type: 'success', title: 'Excluído', message: 'Pedido apagado e estoque devolvido com sucesso.' });
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
              setAlertInfo({ type: 'success', title: 'Estornado', message: 'Pagamento removido com sucesso.' });
          }

          refreshData();
          setShowPinModal(false);
          setPinAction({ type: null, payload: null });

      } catch (error) {
          setPinError('Erro ao executar ação.');
      } finally {
          setIsSubmitting(false);
      }
  };

  const handleLogout = async () => {
      // 3. Apenas trava se a pendência for normal (Não trava se for pendência de Encomenda)
      if (todayBalance.pendente > 0) {
          setAlertInfo({ 
              type: 'error', 
              title: 'Ação Bloqueada', 
              message: `Você não pode fechar o caixa com vendas do dia pendentes. Restam receber: ${formatBRL(todayBalance.pendente)}.` 
          });
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
      
      if (orderData.metadata?.delivery_fee > 0) {
          itemsToPrint.push({
              name: 'Taxa de Entrega',
              qty: 1,
              price: orderData.metadata.delivery_fee
          });
      }

      const isDelivery = orderData.metadata?.order_type === 'delivery';
      const custInfo = orderData.metadata?.customer_info;
      const html = pdvTemplate({ order: orderData, items: itemsToPrint, customerInfo: custInfo, isDelivery });
      executePrint(html);
  };

  const resetPOS = () => {
      setCart([]);
      setCustomer({ id: null, name: '', phone: '', cpf: '', cep: '', street: '', number: '', neighborhood: '', complement: '' });
      setSearch('');
      setCustomerSearch('');
      setSaveCustomer(false);
      setCepWarning('');
      setUpdateAddress(false);
      setDeliveryFee(''); 
      setIsPreOrder(false); // Reseta encomenda
      setDownPayment('');   // Reseta sinal
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
                      {successOrder.metadata?.change_amount > 0 && !successOrder.metadata?.is_pre_order && (
                          <p className="mt-4 text-lg font-black text-slate-800 bg-slate-100 p-3 rounded-2xl border border-slate-200">
                              Troco do Cliente: <span className="text-green-600 block text-2xl mt-1">{formatBRL(successOrder.metadata.change_amount)}</span>
                          </p>
                      )}
                  </div>
                  <div className="flex gap-3">
                      <button onClick={() => handlePrint(successOrder)} className="flex-1 py-4 bg-slate-100 text-slate-700 rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-2 active:scale-95">
                          <Printer size={18}/> Imprimir Via
                      </button>
                      <button onClick={resetPOS} className="flex-1 py-4 bg-yellow-400 text-slate-900 rounded-2xl font-black uppercase text-xs active:scale-95 shadow-lg shadow-yellow-200">
                          Novo Pedido
                      </button>
                  </div>
              </div>
          </div>
      );
  }

  return (
    <div className="flex flex-col md:flex-row h-screen bg-slate-100 overflow-hidden font-bold">
      
      <AlertModal isOpen={!!alertInfo} type={alertInfo?.type} title={alertInfo?.title} message={alertInfo?.message} onClose={() => setAlertInfo(null)} />
      <ConfirmModal isOpen={!!confirmDialog} title={confirmDialog?.title} message={confirmDialog?.message} onCancel={() => setConfirmDialog(null)} onConfirm={confirmDialog?.action} />

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
                      placeholder="****" maxLength={6} value={adminPin} onChange={e => setAdminPin(e.target.value)} autoFocus
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
                      <button onClick={() => navigate('/')} className="p-3 bg-slate-50 rounded-2xl active:scale-90 text-slate-600">
                          <ArrowLeft size={20}/>
                      </button>
                  )}
                  <div>
                      <p className="text-xs font-black text-slate-800 uppercase leading-none">PDV Balcão</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{profile?.full_name || 'Caixa'}</p>
                  </div>
              </div>
              
              <div className="flex bg-slate-100 p-1 rounded-xl flex-1 max-w-sm mx-4 hidden md:flex">
                  <button onClick={() => setActiveTab('pdv')} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${activeTab === 'pdv' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}>Caixa</button>
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
                              className="w-full pl-12 pr-4 py-4 bg-white rounded-2xl text-sm outline-none shadow-sm focus:border-yellow-400 transition-colors" 
                              placeholder="Buscar produto por nome..." 
                              value={search} 
                              onChange={e => setSearch(e.target.value)} 
                          />
                      </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 pb-24 md:pb-6">
                      {filteredProducts.length === 0 ? (
                          <div className="flex flex-col items-center justify-center h-full text-slate-400">
                              <p className="uppercase text-xs font-black">Nenhum produto em estoque.</p>
                          </div>
                      ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                              {filteredProducts.map(p => (
                                  <button 
                                      key={p.id} 
                                      onClick={() => addToCart(p)}
                                      className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md hover:border-yellow-200 active:scale-95 transition-all text-left flex flex-col h-full"
                                  >
                                      <div className="flex-1">
                                          <p className="font-black text-slate-800 text-sm leading-tight">{p.name}</p>
                                          <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold">Estoque: {p.stock}</p>
                                      </div>
                                      <p className="text-indigo-600 font-black font-mono text-lg mt-3">{formatBRL(p.price)}</p>
                                  </button>
                              ))}
                          </div>
                      )}
                  </div>
              </>
          )}

          {activeTab === 'history' && (
              <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50 space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
                      <h2 className="text-sm font-black text-slate-800 uppercase flex items-center gap-2"><History size={18}/> Histórico de Pedidos</h2>
                      
                      <div className="flex items-center gap-2 bg-white p-1 rounded-xl shadow-sm border border-slate-200">
                          <button onClick={() => setHistoryFilter('day')} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase ${historyFilter === 'day' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400'}`}>Dia</button>
                          <button onClick={() => setHistoryFilter('month')} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase ${historyFilter === 'month' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400'}`}>Mês</button>
                          <button onClick={() => setHistoryFilter('all')} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase ${historyFilter === 'all' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400'}`}>Tudo</button>
                          <div className="h-4 w-px bg-slate-200 mx-1"></div>
                          {historyFilter === 'day' && <input type="date" className="text-xs font-bold text-slate-600 outline-none bg-transparent" value={filterDate} onChange={e => setFilterDate(e.target.value)}/>}
                          {historyFilter === 'month' && <input type="month" className="text-xs font-bold text-slate-600 outline-none bg-transparent" value={filterMonth} onChange={e => setFilterMonth(e.target.value)}/>}
                      </div>
                  </div>

                  {displayedHistory.length === 0 && <p className="text-center text-slate-400 text-xs py-8">Nenhum pedido encontrado.</p>}
                  
                  <div className="flex flex-col gap-3">
                      {displayedHistory.map(order => {
                          const isExpanded = expandedOrder === order.id;
                          const pendingAmount = Math.max(0, order.total - (order.paid || 0));
                          
                          return (
                          <div key={order.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden transition-all">
                              
                              <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                                  <div className="flex-1 flex items-center gap-3">
                                      <div className={`p-2 rounded-xl flex-shrink-0 ${order.metadata?.order_type === 'delivery' ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 text-slate-600'}`}>
                                          {order.metadata?.order_type === 'delivery' ? <Bike size={20}/> : <Store size={20}/>}
                                      </div>
                                      <div>
                                          <div className="flex items-center gap-2">
                                              <p className="font-black text-slate-800 text-sm truncate">{order.metadata?.customer_info?.name || 'Cliente Balcão'}</p>
                                              {order.metadata?.is_pre_order && <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded text-[8px] font-black uppercase">Encomenda</span>}
                                          </div>
                                          <p className="text-xs font-bold text-slate-400 mt-0.5">
                                              #{order.id.slice(0,4).toUpperCase()} • {new Date(order.created_at).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}
                                          </p>
                                      </div>
                                  </div>
                                  
                                  <div className="flex items-center gap-4">
                                      <div className="text-right">
                                          <p className="font-mono text-indigo-600 font-black text-base">{formatBRL(order.total)}</p>
                                          {pendingAmount > 0 ? (
                                              <p className="text-[10px] text-orange-500 font-bold uppercase mt-0.5">Falta: {formatBRL(pendingAmount)}</p>
                                          ) : (
                                              <p className="text-[10px] text-green-500 font-bold uppercase mt-0.5">Pago</p>
                                          )}
                                      </div>
                                      
                                      <div className="flex gap-2 border-l border-slate-100 pl-4">
                                          <button onClick={() => handlePrint(order)} className="p-2 bg-indigo-50 text-indigo-600 rounded-xl active:scale-90" title="Imprimir">
                                              <Printer size={16}/>
                                          </button>
                                          <button onClick={() => requestPinAction('order', order)} className="p-2 bg-red-50 text-red-600 rounded-xl active:scale-90" title="Excluir">
                                              <Trash2 size={16}/>
                                          </button>
                                          <button onClick={() => toggleOrderDetails(order.id)} className="p-2 bg-slate-50 text-slate-600 rounded-xl active:scale-90">
                                              {isExpanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                                          </button>
                                      </div>
                                  </div>
                              </div>

                              {isExpanded && (
                                  <div className="p-4 pt-0 border-t border-slate-100 bg-slate-50/50">
                                      <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-4">
                                          <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-100">
                                              <p className="text-[9px] font-black uppercase text-slate-400 mb-2 border-b border-slate-100 pb-1">Produtos</p>
                                              {loadingItems ? <p className="text-xs text-slate-400 py-2">Carregando...</p> : 
                                                  orderItemsLoaded.map(item => (
                                                      <div key={item.id} className="flex justify-between text-xs text-slate-700 mb-1">
                                                          <span className="truncate pr-2">{item.qty}x {item.name}</span>
                                                          <span className="font-mono font-bold flex-shrink-0">{formatBRL(item.price * item.qty)}</span>
                                                      </div>
                                                  ))
                                              }
                                              {order.metadata?.delivery_fee > 0 && (
                                                  <div className="flex justify-between text-xs text-slate-700 mt-2 pt-2 border-t border-slate-100">
                                                      <span className="truncate pr-2">Taxa de Entrega</span>
                                                      <span className="font-mono font-bold flex-shrink-0">{formatBRL(order.metadata.delivery_fee)}</span>
                                                  </div>
                                              )}
                                          </div>

                                          <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-100">
                                              <p className="text-[9px] font-black uppercase text-slate-400 mb-2 border-b border-slate-100 pb-1">Pagamentos</p>
                                              {loadingItems ? <p className="text-xs text-slate-400 py-2">Carregando...</p> : 
                                                  orderPaymentsLoaded.length > 0 ? orderPaymentsLoaded.map(pay => (
                                                      <div key={pay.id} className="flex justify-between items-center text-xs text-slate-600 mb-1.5 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                                          <div>
                                                              <span className="font-bold text-slate-700 block">{pay.method}</span>
                                                              <span className="text-[9px] text-slate-400">{new Date(pay.created_at).toLocaleDateString('pt-BR')}</span>
                                                          </div>
                                                          <div className="flex items-center gap-2">
                                                              <span className="font-mono font-black text-green-600">{formatBRL(pay.amount)}</span>
                                                              <button onClick={() => requestPinAction('payment', pay)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={12}/></button>
                                                          </div>
                                                      </div>
                                                  )) : <p className="text-[10px] text-slate-400">Sem pagamentos.</p>
                                              }
                                              
                                              {pendingAmount > 0 && !showPaymentForm && (
                                                  <button onClick={() => {setShowPaymentForm(true); setNewPaymentAmount(pendingAmount);}} className="w-full mt-2 py-2 bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase rounded-lg border border-indigo-100">
                                                      + Receber Restante
                                                  </button>
                                              )}

                                              {showPaymentForm && (
                                                  <div className="mt-2 p-2 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                                                      <div className="grid grid-cols-2 gap-2">
                                                          <select className="p-2 bg-white rounded-lg text-xs font-bold outline-none border border-slate-100" value={newPaymentMethod} onChange={e=>setNewPaymentMethod(e.target.value)}>
                                                              <option>Dinheiro</option><option>Pix</option><option>Cartão</option>
                                                          </select>
                                                          <input type="number" className="p-2 bg-white rounded-lg text-xs font-bold outline-none border border-slate-100" value={newPaymentAmount} onChange={e=>setNewPaymentAmount(e.target.value)} placeholder="Valor"/>
                                                      </div>
                                                      <div className="flex gap-2">
                                                          <button onClick={() => setShowPaymentForm(false)} className="flex-1 py-1.5 text-[10px] font-black uppercase text-slate-500 bg-white border border-slate-200 rounded-lg">Cancelar</button>
                                                          <button onClick={() => handleAddPayment(order)} disabled={isSubmitting} className="flex-1 py-1.5 text-[10px] font-black uppercase text-white bg-green-500 rounded-lg flex justify-center items-center">
                                                              {isSubmitting ? <Loader2 size={12} className="animate-spin"/> : 'Confirmar'}
                                                          </button>
                                                      </div>
                                                  </div>
                                              )}
                                          </div>
                                      </div>
                                  </div>
                              )}
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
                          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Valores em Caixa</h3>
                          
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

                          <div className="pt-4 border-t border-slate-100 space-y-2">
                              <div className="flex justify-between items-center px-2">
                                  <div className="flex items-center gap-2 text-orange-500">
                                      <ListFilter size={18} /> <span className="text-xs font-black uppercase">Falta Receber (Vendas Normais)</span>
                                  </div>
                                  <span className="font-mono font-black text-orange-500">{formatBRL(todayBalance.pendente)}</span>
                              </div>
                              <div className="flex justify-between items-center px-2 opacity-70">
                                  <div className="flex items-center gap-2 text-purple-600">
                                      <Clock size={16} /> <span className="text-[10px] font-black uppercase">A Receber Futuramente (Encomendas)</span>
                                  </div>
                                  <span className="font-mono font-bold text-purple-600">{formatBRL(todayBalance.pendente_encomenda)}</span>
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
          )}

          {activeTab === 'pdv' && (
              <div className="md:hidden absolute bottom-4 left-4 right-4 z-20">
                  <button onClick={() => setShowMobileCart(true)} className="w-full bg-yellow-400 text-slate-900 p-4 rounded-2xl shadow-xl flex justify-between items-center active:scale-95 transition-transform">
                      <div className="flex items-center gap-2">
                          <div className="bg-white/20 p-2 rounded-lg relative">
                              <ShoppingCart size={20} />
                              {cartItemsCount > 0 && <span className="absolute -top-2 -right-2 bg-indigo-600 text-white w-5 h-5 rounded-full text-[10px] flex items-center justify-center border-2 border-yellow-400">{cartItemsCount}</span>}
                          </div>
                          <span className="uppercase text-xs font-black">Ver Carrinho</span>
                      </div>
                      <span className="font-mono text-lg">{formatBRL(finalTotal)}</span>
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
              <div className="flex items-center gap-3">
                  <h2 className="text-lg font-black text-slate-800 uppercase tracking-tighter">Carrinho</h2>
                  {cart.length > 0 && (
                      <button onClick={() => setConfirmDialog({ title: 'Limpar Carrinho', message: 'Deseja realmente cancelar esta venda?', action: () => { resetPOS(); setConfirmDialog(null); } })} className="text-[10px] bg-red-50 text-red-500 font-bold uppercase px-2 py-1 rounded-md active:scale-95 transition-transform">
                          Limpar
                      </button>
                  )}
              </div>
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
                      <div key={item.cartItemId} className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                              <p className="font-bold text-slate-800 text-xs truncate">{item.name}</p>
                              <p className="font-mono text-indigo-600 font-black text-sm mb-1">{formatBRL(item.price * item.qty)}</p>
                              
                              {editingObsId === item.cartItemId ? (
                                  <div className="flex items-center gap-1 mt-1">
                                      <input 
                                          type="text" 
                                          autoFocus
                                          className="flex-1 p-1.5 bg-slate-50 border border-slate-200 rounded text-[10px] font-bold outline-none focus:border-yellow-400"
                                          placeholder="Ex: Sem cebola..."
                                          value={tempObs}
                                          onChange={e => setTempObs(e.target.value)}
                                          onKeyDown={e => e.key === 'Enter' && saveObservation(item.cartItemId)}
                                      />
                                      <button onClick={() => saveObservation(item.cartItemId)} className="p-1.5 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 transition-colors"><CheckCircle2 size={12}/></button>
                                  </div>
                              ) : (
                                  <button onClick={() => { setEditingObsId(item.cartItemId); setTempObs(item.observation || ''); }} className="text-[9px] text-indigo-500 hover:text-indigo-700 underline font-bold flex items-center gap-1 mt-0.5">
                                      <MessageSquare size={10} /> {item.observation ? `Obs: ${item.observation}` : 'Adicionar Obs'}
                                  </button>
                              )}
                          </div>
                          <div className="flex items-center gap-3 bg-slate-50 p-1.5 rounded-xl border border-slate-100">
                              <button onClick={() => updateQty(item.cartItemId, -1)} className="w-8 h-8 bg-white rounded-lg shadow-sm flex items-center justify-center active:scale-90 transition-colors">
                                  {item.qty === 1 ? <Trash2 size={14} className="text-red-500"/> : <Minus size={14} className="text-slate-600"/>}
                              </button>
                              <span className="font-black text-sm w-4 text-center">{item.qty}</span>
                              <button onClick={() => updateQty(item.cartItemId, 1)} className="w-8 h-8 bg-slate-800 text-white rounded-lg shadow-sm flex items-center justify-center active:scale-90"><Plus size={14}/></button>
                          </div>
                      </div>
                  ))
              )}
          </div>

          {cart.length > 0 && (
              <div className="bg-white border-t border-slate-100 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] p-4 space-y-4 overflow-y-auto max-h-[60vh] md:max-h-none z-20">
                  
                  {/* 2. BLOCO DE ENCOMENDA ADICIONADO AQUI */}
                  <div className="flex justify-between items-center bg-purple-50 p-3 rounded-2xl border border-purple-100">
                      <div className="flex items-center gap-2 text-purple-700">
                          <Clock size={16} /> <span className="text-[10px] font-black uppercase tracking-widest">Encomenda (Sinal)</span>
                      </div>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                          <input type="checkbox" checked={isPreOrder} onChange={e => { setIsPreOrder(e.target.checked); setPaymentStatus('paid'); }} className="accent-purple-600 w-4 h-4"/>
                          <span className="text-[9px] font-black text-purple-600 uppercase">Ativar</span>
                      </label>
                  </div>

                  <div className="flex bg-slate-100 p-1 rounded-2xl">
                      <button onClick={() => setOrderType('balcao')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 transition-all ${orderType === 'balcao' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400'}`}>
                          <Store size={16}/> Balcão
                      </button>
                      <button onClick={() => setOrderType('delivery')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 transition-all ${orderType === 'delivery' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400'}`}>
                          <Bike size={16}/> Delivery
                      </button>
                  </div>

                  <div className="space-y-2 bg-slate-50 p-3 rounded-3xl border border-slate-100">
                      <div className="flex justify-between items-center mb-1">
                          <div className="flex items-center gap-2 text-indigo-600">
                              <User size={14} /> <span className="text-[10px] font-black uppercase tracking-widest">Cliente</span>
                          </div>
                          
                          {!customer.id ? (
                              customer.name && (
                                  <label className="flex items-center gap-1.5 cursor-pointer">
                                      <input type="checkbox" checked={saveCustomer} onChange={e => setSaveCustomer(e.target.checked)} className="accent-yellow-400 w-4 h-4"/>
                                      <span className="text-[9px] font-black text-slate-600 uppercase">Salvar Cadastro</span>
                                  </label>
                              )
                          ) : (
                              <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-[9px] font-black uppercase">Cliente Vinculado</span>
                          )}
                      </div>
                      
                      <div className="relative">
                          <input 
                              className="w-full p-2.5 bg-white rounded-xl text-xs font-bold outline-none border border-slate-200 focus:border-yellow-400" 
                              placeholder="Buscar Nome, CPF ou Tel..." 
                              value={customerSearch || customer.name} 
                              onChange={e => {
                                  setCustomerSearch(e.target.value);
                                  setCustomer({...customer, id: null, name: e.target.value});
                                  setShowCustomerDropdown(true);
                              }} 
                              onFocus={() => setShowCustomerDropdown(true)}
                          />
                          {showCustomerDropdown && (customerSearch || customer.name) && filteredCustomers.length > 0 && (
                              <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-slate-200 shadow-xl rounded-xl z-50 max-h-48 overflow-y-auto">
                                  {filteredCustomers.map(c => (
                                      <button key={c.id} onClick={() => handleSelectCustomer(c)} className="w-full text-left p-3 hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors">
                                          <p className="text-xs font-bold text-slate-800">{c.name}</p>
                                          <p className="text-[9px] text-slate-500 mt-0.5">{c.phone || 'S/ Tel'} {c.cpf ? `• CPF: ${c.cpf}` : ''}</p>
                                      </button>
                                  ))}
                              </div>
                          )}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                          <input className="w-full p-2.5 bg-white rounded-xl text-xs font-bold outline-none border border-slate-200 focus:border-yellow-400" placeholder="Telefone" value={customer.phone} onChange={e => setCustomer({...customer, phone: e.target.value})} />
                          <input className="w-full p-2.5 bg-white rounded-xl text-xs font-bold outline-none border border-slate-200 focus:border-yellow-400" placeholder="CPF (Opcional)" maxLength={14} value={customer.cpf} onChange={e => setCustomer({...customer, cpf: e.target.value})} />
                      </div>

                      {orderType === 'delivery' && (
                          <div className="animate-in slide-in-from-top-2 pt-2 mt-2 border-t border-slate-200">
                              
                              {customer.id && (
                                  <div className="flex items-center justify-between bg-white p-2 rounded-xl border border-indigo-100 mb-2">
                                      <span className="text-[9px] font-bold text-slate-500 flex items-center gap-1">
                                          <MapPin size={12}/> {customer.street ? 'Endereço do Cadastro' : 'Adicionar end. ao cadastro?'}
                                      </span>
                                      <label className="flex items-center gap-1.5 cursor-pointer">
                                          <input type="checkbox" checked={updateAddress} onChange={e => setUpdateAddress(e.target.checked)} className="accent-indigo-600 w-3.5 h-3.5"/>
                                          <span className="text-[9px] font-black uppercase text-indigo-600">Salvar Modificações</span>
                                      </label>
                                  </div>
                              )}

                              <div className="grid grid-cols-3 gap-2">
                                  <div className="col-span-3">
                                      <input className="w-full p-2.5 bg-white rounded-xl text-xs font-bold outline-none border border-slate-200 focus:border-yellow-400" placeholder="CEP" value={customer.cep} onChange={handleCepChange} />
                                      {cepWarning && <p className="text-[9px] font-bold text-orange-500 mt-1 ml-1 flex items-center gap-1"><AlertCircle size={10}/> {cepWarning}</p>}
                                  </div>
                                  <input className="col-span-2 w-full p-2.5 bg-white rounded-xl text-xs font-bold outline-none border border-slate-200 focus:border-yellow-400" placeholder="Rua / Avenida" value={customer.street} onChange={e => setCustomer({...customer, street: e.target.value})} />
                                  <input className="w-full p-2.5 bg-white rounded-xl text-xs font-bold outline-none border border-slate-200 focus:border-yellow-400" placeholder="Num" value={customer.number} onChange={e => setCustomer({...customer, number: e.target.value})} />
                                  <input className="col-span-3 w-full p-2.5 bg-white rounded-xl text-xs font-bold outline-none border border-slate-200 focus:border-yellow-400" placeholder="Bairro" value={customer.neighborhood} onChange={e => setCustomer({...customer, neighborhood: e.target.value})} />
                                  <input className="col-span-3 w-full p-2.5 bg-white rounded-xl text-xs font-bold outline-none border border-slate-200 focus:border-yellow-400" placeholder="Complemento (Apto, Bloco...)" value={customer.complement} onChange={e => setCustomer({...customer, complement: e.target.value})} />
                              </div>
                          </div>
                      )}
                  </div>

                  <div className="space-y-2">
                      <div className="flex bg-slate-100 p-1 rounded-xl">
                          <button onClick={() => setPaymentStatus('paid')} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${paymentStatus === 'paid' ? 'bg-green-500 text-white shadow-sm' : 'text-slate-400'}`}>Pago</button>
                          {/* ESCONDE O PAGAR DEPOIS SE FOR ENCOMENDA */}
                          {!isPreOrder && (
                              <button onClick={() => setPaymentStatus('pending')} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${paymentStatus === 'pending' ? 'bg-orange-400 text-white shadow-sm' : 'text-slate-400'}`}>Pagar Depois</button>
                          )}
                      </div>

                      {paymentStatus === 'paid' && (
                          <div className="grid grid-cols-3 gap-2 animate-in fade-in">
                              {['Dinheiro', 'Pix', 'Cartão'].map(m => (
                                  <button 
                                      key={m} 
                                      onClick={() => setPaymentMethod(m)} 
                                      className={`py-2 rounded-xl border-2 flex flex-col items-center gap-1 transition-all ${paymentMethod === m ? 'border-yellow-400 bg-yellow-50 text-yellow-700' : 'border-slate-100 bg-white text-slate-400'}`}
                                  >
                                      {m === 'Dinheiro' ? <Banknote size={14}/> : m === 'Pix' ? <QrCode size={14}/> : <CreditCard size={14}/>}
                                      <span className="text-[9px] font-black uppercase">{m}</span>
                                  </button>
                              ))}
                          </div>
                      )}

                      {/* BLOCO DE SINAL DA ENCOMENDA */}
                      {isPreOrder && paymentStatus === 'paid' && (
                          <div className="flex items-center gap-2 p-3 bg-purple-50 rounded-xl border border-purple-200 animate-in slide-in-from-top-2 mt-2">
                              <div className="flex-1">
                                  <label className="text-[9px] font-black uppercase text-purple-700 block mb-1">Entrada (Sinal)</label>
                                  <input 
                                      type="number" 
                                      className="w-full p-2 bg-white rounded-lg text-sm font-bold outline-none border border-purple-200 focus:border-purple-400" 
                                      placeholder="R$ 0,00" 
                                      value={downPayment} 
                                      onChange={e => setDownPayment(e.target.value)} 
                                  />
                              </div>
                              <div className="flex-1 text-right">
                                  <span className="text-[9px] font-black uppercase text-purple-700 block mb-1">Restante (Pendente)</span>
                                  <span className={`text-lg font-black font-mono text-purple-700`}>
                                      {formatBRL(Math.max(0, finalTotal - Number(downPayment || 0)))}
                                  </span>
                              </div>
                          </div>
                      )}

                      {/* BLOCO DE TROCO NORMAL (ESCONDIDO SE FOR ENCOMENDA) */}
                      {!isPreOrder && paymentMethod === 'Dinheiro' && paymentStatus === 'paid' && (
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
                      {orderType === 'delivery' && (
                          <div className="flex justify-between items-center mb-2 animate-in fade-in">
                              <span className="text-xs font-black uppercase text-slate-400 flex items-center gap-2">
                                  Taxa de Entrega
                                  {isCalculatingFee && <Loader2 size={12} className="animate-spin text-indigo-500" />}
                              </span>
                              <input 
                                  type="number" 
                                  className="w-24 p-2 bg-white rounded-lg text-sm font-bold outline-none border border-slate-200 focus:border-yellow-400 text-right" 
                                  placeholder="R$ 0,00" 
                                  value={deliveryFee} 
                                  onChange={e => setDeliveryFee(e.target.value)} 
                              />
                          </div>
                      )}
                      <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-black uppercase text-slate-400">Total a Cobrar</span>
                          <span className="text-2xl font-black font-mono text-slate-800">{formatBRL(finalTotal)}</span>
                      </div>
                      <button 
                          onClick={handleCheckout} 
                          disabled={isSubmitting}
                          className="w-full py-4 bg-yellow-400 text-slate-900 rounded-2xl font-black uppercase text-xs shadow-xl shadow-yellow-200/50 active:scale-95 transition-transform flex justify-center items-center gap-2 disabled:opacity-70"
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