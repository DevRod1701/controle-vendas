import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
    ArrowLeft, PieChart, TrendingUp, FileText, Printer, Search, ChevronLeft, ChevronRight, 
    ChevronDown, ChevronUp, Calculator, Share2, Save, Loader2, CheckCircle2, Trash2, 
    Plus, DollarSign, Calendar as CalendarIcon, Clock, X, AlertTriangle, RefreshCw, Store,
    Banknote, QrCode, CreditCard
} from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabase';
import { formatBRL } from '../../utils/formatters';
import { executePrint } from '../../utils/printHandler';
import { reportTemplate } from '../../utils/print/reportTemplate'; 
import { commissionTemplate } from '../../utils/print/commissionTemplate'; 

const Reports = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { orders, payments, settlements, refreshData } = useData();
  const { session, isAdmin, profile } = useAuth(); 

  const [dateMode, setDateMode] = useState('month'); 
  const now = new Date();
  
  const initialYear = location.state?.monthStr ? Number(location.state.monthStr.split('-')[0]) : now.getFullYear();
  const initialMonthStr = location.state?.monthStr || new Date().toISOString().slice(0, 7);
  const initialSeller = location.state?.sellerId || (isAdmin ? 'all' : session?.user?.id);

  const [viewYear, setViewYear] = useState(initialYear);
  const [selectedMonthStr, setSelectedMonthStr] = useState(initialMonthStr); 
  const [showMonthPicker, setShowMonthPicker] = useState(false); 

  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  
  const [selectedSellerState, setSelectedSellerState] = useState(initialSeller);
  const activeSeller = isAdmin ? selectedSellerState : session?.user?.id;
  
  const [activeSellerRole, setActiveSellerRole] = useState(null);
  const [sellerSearch, setSellerSearch] = useState('');
  const [showSellerDropdown, setShowSellerDropdown] = useState(false);
  const [reportType, setReportType] = useState('full'); 
  const [expandRanking, setExpandRanking] = useState(false); 
  const [tempRate, setTempRate] = useState(20);
  const [extraDiscountsList, setExtraDiscountsList] = useState([]);
  const [isSavingAcerto, setIsSavingAcerto] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const monthsList = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

  useEffect(() => {
      setExtraDiscountsList([]);
      setShowPaymentForm(false);
  }, [activeSeller, selectedMonthStr]);

  const handleSelectMonth = (monthIndex) => {
    const m = String(monthIndex + 1).padStart(2, '0');
    setSelectedMonthStr(`${viewYear}-${m}`);
    setShowMonthPicker(false); 
  };

  useEffect(() => {
      if (activeSeller !== 'all') {
          supabase.from('profiles').select('commission_rate, role').eq('id', activeSeller).single()
          .then(({data}) => { 
              if (data) {
                  setTempRate(data.commission_rate || 0); 
                  setActiveSellerRole(data.role);
              }
          });
      } else {
          setActiveSellerRole(null);
      }
  }, [activeSeller]);

  const handleAddDiscount = () => {
      setExtraDiscountsList([...extraDiscountsList, { id: Date.now(), reason: '', amount: '' }]);
  };

  const handleUpdateDiscount = (id, field, value) => {
      setExtraDiscountsList(prev => prev.map(d => d.id === id ? { ...d, [field]: value } : d));
  };

  const handleRemoveDiscount = (id) => {
      setExtraDiscountsList(prev => prev.filter(d => d.id !== id));
  };

  const filteredData = useMemo(() => {
    let start, end;
    if (dateMode === 'month') {
        const [y, m] = selectedMonthStr.split('-');
        start = new Date(Number(y), Number(m) - 1, 1);
        end = new Date(Number(y), Number(m), 0, 23, 59, 59);
    } else {
        start = customStart ? new Date(customStart + 'T00:00:00') : new Date('2000-01-01');
        end = customEnd ? new Date(customEnd + 'T23:59:59') : new Date();
    }

    const filteredOrders = orders.filter(o => {
        const d = new Date(o.created_at);
        const matchDate = d >= start && d <= end;
        const matchSeller = activeSeller === 'all' || o.seller_id === activeSeller;
        return matchDate && matchSeller && o.status === 'approved';
    });

    const filteredPayments = payments.filter(p => {
        const originalOrder = orders.find(o => o.id === p.order_id);
        const referenceDate = originalOrder ? new Date(originalOrder.created_at) : new Date(p.date + 'T12:00:00');
        const matchDate = referenceDate >= start && referenceDate <= end;
        const matchSeller = activeSeller === 'all' || (originalOrder && originalOrder.seller_id === activeSeller);
        return matchDate && matchSeller;
    });

    return { orders: filteredOrders, payments: filteredPayments, startDate: start, endDate: end };
  }, [orders, payments, selectedMonthStr, customStart, customEnd, dateMode, activeSeller]);

  const groupedPayments = useMemo(() => {
      const rawPayments = filteredData.payments;
      const sortedPayments = [...rawPayments].sort((a, b) => new Date(b.date) - new Date(a.date));
      const processedIds = new Set();
      const result = [];

      sortedPayments.forEach(p => {
          if (processedIds.has(p.id)) return;
          const group = sortedPayments.filter(other => 
              !processedIds.has(other.id) && other.date === p.date && other.method === p.method && other.description === p.description && other.has_proof === p.has_proof 
          );

          if (group.length > 1) {
              const totalAmount = group.reduce((acc, item) => acc + Number(item.amount), 0);
              result.push({ id: `group-${p.id}`, isGroup: true, items: group, amount: totalAmount, date: p.date, method: p.method, description: p.description, has_proof: p.has_proof });
              group.forEach(item => processedIds.add(item.id));
          } else {
              result.push({ ...p, isGroup: false });
              processedIds.add(p.id);
          }
      });
      return result;
  }, [filteredData.payments]);

  const stats = useMemo(() => {
    const totalSales = filteredData.orders.reduce((acc, o) => acc + (o.type === 'sale' ? Number(o.total) : 0), 0);
    const totalReturnsValue = filteredData.orders.reduce((acc, o) => acc + (o.type === 'return' ? Number(o.total) : 0), 0);
    const totalReceived = groupedPayments.reduce((acc, p) => acc + Number(p.amount), 0);
    const netSales = totalSales; 

    const productMap = {};
    filteredData.orders.forEach(o => {
        if (o.type === 'sale') {
            o.order_items.forEach(item => {
                if (!productMap[item.name]) productMap[item.name] = { qty: 0, total: 0 };
                productMap[item.name].qty += item.qty;
                productMap[item.name].total += (item.qty * item.price);
            });
        }
    });

    const rankedProducts = Object.entries(productMap)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.qty - a.qty);

    return { totalSales, totalReturnsValue, netSales, totalReceived, ranking: rankedProducts };
  }, [filteredData.orders, groupedPayments]);

  const balcaoTotals = useMemo(() => {
      if (activeSellerRole !== 'balcao') return null;
      const totals = { Dinheiro: 0, Pix: 0, Cartão: 0, pendente: 0 };
      
      filteredData.orders.forEach(o => {
          const paid = Number(o.paid || 0);
          const total = Number(o.total || 0);
          totals.pendente += Math.max(0, total - paid);
          
          if (paid > 0) {
              const method = o.payment_method || 'Dinheiro';
              if (totals[method] !== undefined) totals[method] += paid;
          }
      });
      return totals;
  }, [filteredData, activeSellerRole]);

  const saldoAnterior = useMemo(() => {
      if (activeSeller === 'all' || !settlements) return 0;
      const pastSettlements = settlements.filter(s => s.seller_id === activeSeller && s.month < selectedMonthStr);
      const pastPayouts = pastSettlements.reduce((acc, s) => acc + Number(s.final_payout || 0), 0);
      const pastPaid = pastSettlements.reduce((acc, s) => acc + Number(s.amount_paid || 0), 0);
      return pastPayouts - pastPaid;
  }, [settlements, activeSeller, selectedMonthStr]);

  const acertoPreview = useMemo(() => {
      if (activeSeller === 'all' || dateMode !== 'month') return null;

      const totalReceivedCash = filteredData.payments.filter(p => p.method !== 'Consumo').reduce((acc, p) => acc + Number(p.amount), 0);
      const totalConsumed = filteredData.payments.filter(p => p.method === 'Consumo').reduce((acc, p) => acc + Number(p.amount), 0);
      const rate = Number(tempRate) || 0;
      const commissionGross = totalReceivedCash * (rate / 100);
      const totalExtraDiscounts = extraDiscountsList.reduce((acc, desc) => acc + Number(desc.amount || 0), 0);
      
      const rawFinalPayoutMonth = commissionGross - totalConsumed - totalExtraDiscounts;
      
      let compensationApplied = 0;
      if (rawFinalPayoutMonth < 0 && saldoAnterior > 0) {
          compensationApplied = Math.min(Math.abs(rawFinalPayoutMonth), saldoAnterior);
      }
      
      const finalPayoutMonth = rawFinalPayoutMonth + compensationApplied;
      const totalToPay = finalPayoutMonth + (saldoAnterior - compensationApplied);

      return { 
          totalReceivedCash, 
          totalConsumed, 
          commissionGross, 
          discount: totalExtraDiscounts, 
          rawFinalPayoutMonth, 
          compensationApplied, 
          finalPayoutMonth, 
          totalToPay, 
          rate 
      };
  }, [filteredData, activeSeller, dateMode, tempRate, extraDiscountsList, saldoAnterior]);

  const currentSettlement = useMemo(() => {
      if (!settlements || activeSeller === 'all') return null;
      return settlements.find(s => s.seller_id === activeSeller && s.month === selectedMonthStr);
  }, [settlements, activeSeller, selectedMonthStr]);

  const discrepancyDetails = useMemo(() => {
      if (!currentSettlement || !acertoPreview) return null;
      const diffSales = Math.abs(Number(currentSettlement.total_sales) - stats.totalSales);
      const diffRec = Math.abs(Number(currentSettlement.total_received) - acertoPreview.totalReceivedCash);
      const diffCons = Math.abs(Number(currentSettlement.total_consumed) - acertoPreview.totalConsumed);
      if (diffSales > 0.01 || diffRec > 0.01 || diffCons > 0.01) {
          const newGross = acertoPreview.totalReceivedCash * (Number(currentSettlement.commission_rate) / 100);
          const newPayoutMonth = newGross - acertoPreview.totalConsumed - Number(currentSettlement.extra_discount); 
          return { needsUpdate: true, newGross, newPayoutMonth };
      }
      return { needsUpdate: false };
  }, [currentSettlement, acertoPreview, stats.totalSales]);

  const sellersList = useMemo(() => {
    const unique = new Set();
    const list = [];
    orders.forEach(o => {
        if (o.seller_id && !unique.has(o.seller_id)) {
            unique.add(o.seller_id);
            list.push({ id: o.seller_id, name: o.seller_name || 'Vendedor' });
        }
    });
    return list;
  }, [orders]);

  const filteredSellers = sellersList.filter(s => s.name.toLowerCase().includes(sellerSearch.toLowerCase()));
  const currentSellerName = activeSeller === 'all' ? 'Todos os Operadores' : sellersList.find(s => s.id === activeSeller)?.name || 'Operador';

  const handleSaveSettlement = async () => {
      if (!acertoPreview) return;
      const validDiscounts = extraDiscountsList.filter(d => Number(d.amount) > 0);
      setIsSavingAcerto(true);

      let remainingCompensation = acertoPreview.compensationApplied;

      if (remainingCompensation > 0) {
          const pendingPast = settlements
              .filter(s => s.seller_id === activeSeller && s.month < selectedMonthStr && s.status !== 'paid')
              .sort((a, b) => a.month.localeCompare(b.month));

          const updates = [];
          for (let s of pendingPast) {
              if (remainingCompensation <= 0) break;
              const debt = Number(s.final_payout) - Number(s.amount_paid);
              
              if (debt > 0) {
                  const applied = Math.min(remainingCompensation, debt);
                  remainingCompensation -= applied;

                  const autoPayment = {
                      id: Date.now().toString() + Math.random(),
                      amount: applied,
                      date: new Date().toISOString().split('T')[0],
                      reason: `Compensação `,
                      linked_month: selectedMonthStr, 
                      is_auto: true
                  };

                  const newHistory = [...(s.payments_history || []), autoPayment];
                  const newPaid = Number(s.amount_paid || 0) + applied;
                  const newStatus = newPaid >= (Number(s.final_payout) - 0.01) ? 'paid' : 'pending';

                  updates.push({ id: s.id, payments_history: newHistory, amount_paid: newPaid, status: newStatus });
              }
          }
          for (let u of updates) {
              await supabase.from('seller_settlements').update({
                  payments_history: u.payments_history,
                  amount_paid: u.amount_paid,
                  status: u.status
              }).eq('id', u.id);
          }
      }

      const payload = {
          seller_id: activeSeller,
          month: selectedMonthStr,
          total_sales: stats.totalSales,
          total_received: acertoPreview.totalReceivedCash,
          commission_rate: Number(tempRate),
          commission_gross: acertoPreview.commissionGross,
          total_consumed: acertoPreview.totalConsumed,
          extra_discount: acertoPreview.discount, 
          extra_discounts_list: validDiscounts,   
          final_payout: acertoPreview.finalPayoutMonth,
          amount_paid: 0,
          payments_history: [],
          status: acertoPreview.totalToPay <= 0.01 ? 'paid' : 'pending' 
      };
      
      const { error } = await supabase.from('seller_settlements').insert([payload]);
      if (error) alert("Erro ao salvar comissão.");
      else {
          setExtraDiscountsList([]); 
          refreshData();
      }
      setIsSavingAcerto(false);
  };

  const handleUpdateSettlement = async () => {
      if (!currentSettlement || !discrepancyDetails) return;
      setIsSavingAcerto(true);
      const newTotalToPay = discrepancyDetails.newPayoutMonth + saldoAnterior;
      const newStatus = (currentSettlement.amount_paid || 0) >= (newTotalToPay - 0.01) ? 'paid' : 'pending';

      const { error } = await supabase.from('seller_settlements').update({
          total_sales: stats.totalSales,
          total_received: acertoPreview.totalReceivedCash,
          commission_gross: discrepancyDetails.newGross,
          total_consumed: acertoPreview.totalConsumed,
          final_payout: discrepancyDetails.newPayoutMonth,
          status: newStatus
      }).eq('id', currentSettlement.id);

      if (!error) refreshData();
      else alert("Erro ao atualizar base da comissão.");
      setIsSavingAcerto(false);
  };

  const handleDeleteSettlement = async () => {
      if (!currentSettlement) return;
      if (!window.confirm("Atenção: Ao excluir este fechamento, todos os pagamentos em cascata e compensações que ele gerou em meses anteriores também serão desfeitos. Confirmar?")) return;
      
      setIsSavingAcerto(true);

      const allSellerSettlements = settlements.filter(s => s.seller_id === activeSeller && s.id !== currentSettlement.id);
      const updates = [];

      for (let s of allSellerSettlements) {
          if (s.payments_history && s.payments_history.some(p => p.linked_month === currentSettlement.month)) {
              const newHistory = s.payments_history.filter(p => p.linked_month !== currentSettlement.month);
              const removedAmount = s.payments_history.filter(p => p.linked_month === currentSettlement.month).reduce((acc, p) => acc + Number(p.amount), 0);
              
              const newPaid = Math.max(0, Number(s.amount_paid || 0) - removedAmount);
              const newStatus = newPaid >= (Number(s.final_payout) - 0.01) ? 'paid' : 'pending';
              updates.push({ id: s.id, payments_history: newHistory, amount_paid: newPaid, status: newStatus });
          }
      }

      for (let u of updates) {
          await supabase.from('seller_settlements').update({
              payments_history: u.payments_history,
              amount_paid: u.amount_paid,
              status: u.status
          }).eq('id', u.id);
      }

      await supabase.from('seller_settlements').delete().eq('id', currentSettlement.id);
      refreshData();
      setExtraDiscountsList([]); 
      setIsSavingAcerto(false);
  };

  const handleAddPayment = async () => {
      if (!payAmount || Number(payAmount) < 0.01) return;
      setIsSavingAcerto(true);

      const totalPaidNow = Number(payAmount);
      const paymentDate = payDate;
      const paymentId = Date.now().toString() + Math.random();

      // 1. Pegamos o fechamento do mês que estamos vendo agora
      const current = currentSettlement;
      if (!current) {
          setIsSavingAcerto(false);
          return;
      }

      // 2. Criamos o novo histórico incluindo o valor CHEIO que você digitou
      const newHistory = [...(current.payments_history || []), { 
          id: paymentId, 
          amount: totalPaidNow, 
          date: paymentDate,
          reason: 'Acerto Manual',
          linked_month: selectedMonthStr 
      }];

      // 3. Calculamos o novo total pago acumulado neste mês
      const newAmountPaidAccumulated = Number(current.amount_paid || 0) + totalPaidNow;

      // 4. Verificamos se quitou (considerando o Líquido + Saldo Anterior)
      const totalToPayInThisMonth = Number(current.final_payout) + saldoAnterior;
      
      // Se o que já foi pago + o que está sendo pago agora cobre a dívida (com margem de erro)
      const isPaid = newAmountPaidAccumulated >= (totalToPayInThisMonth - 0.01);

      // 5. Atualizamos APENAS o registro do mês atual com o valor literal
      const { error } = await supabase.from('seller_settlements').update({
          payments_history: newHistory,
          amount_paid: newAmountPaidAccumulated,
          status: isPaid ? 'paid' : 'pending'
      }).eq('id', current.id);

      if (error) {
          console.error("Erro ao salvar pagamento:", error);
          alert("Erro ao registrar pagamento.");
      }

      setShowPaymentForm(false);
      setPayAmount('');
      refreshData();
      setIsSavingAcerto(false);
  };

  const handleRemovePayment = async (paymentIdToRemove) => {
      if (!window.confirm("Excluir este pagamento?")) return;
      setIsSavingAcerto(true);

      const history = currentSettlement.payments_history || [];
      const paymentToRemove = history.find(p => p.id === paymentIdToRemove);
      if (!paymentToRemove) {
          setIsSavingAcerto(false);
          return;
      }

      const newHistory = history.filter(p => p.id !== paymentIdToRemove);
      const newAmountPaid = Math.max(0, Number(currentSettlement.amount_paid || 0) - Number(paymentToRemove.amount));
      
      const currentTotalToPay = Number(currentSettlement.final_payout) + saldoAnterior;
      const newStatus = newAmountPaid >= (currentTotalToPay - 0.01) ? 'paid' : 'pending';

      await supabase.from('seller_settlements').update({
          payments_history: newHistory,
          amount_paid: newAmountPaid,
          status: newStatus
      }).eq('id', currentSettlement.id);

      refreshData();
      setIsSavingAcerto(false);
  };

  const currentRenderDetails = useMemo(() => {
      if (!currentSettlement) return { rawNet: 0, compensation: 0 };
      
      const rawGross = Number(currentSettlement.commission_gross) || 0;
      const consumed = Number(currentSettlement.total_consumed) || 0;
      let totalDiscounts = 0;
      if (currentSettlement.extra_discounts_list?.length > 0) {
          totalDiscounts = currentSettlement.extra_discounts_list.reduce((acc, d) => acc + Number(d.amount), 0);
      } else {
          totalDiscounts = Number(currentSettlement.extra_discount) || 0;
      }
      
      const rawNet = rawGross - consumed - totalDiscounts;
      const finalPayout = Number(currentSettlement.final_payout) || 0;
      
      const compensation = Math.max(0, finalPayout - rawNet);
      
      return { rawNet, compensation };
  }, [currentSettlement]);

  const handleShareHolerite = () => {
      if (!currentSettlement || !currentRenderDetails) return;
      
      const paymentsText = (currentSettlement.payments_history || []).length > 0 
          ? `\n\n💳 *Pagamentos Efetuados:*\n` + currentSettlement.payments_history.map(p => `• ${new Date(p.date).toLocaleDateString('pt-BR')}: ${formatBRL(p.amount)}`).join('\n')
          : '';

      const currentTotalToPay = Number(currentSettlement.final_payout) + saldoAnterior;
      const remaining = currentTotalToPay - (currentSettlement.amount_paid || 0);

      let saldoAntStr = '';
      if (saldoAnterior > 0) saldoAntStr = `➕ Saldo Atrasado Anterior: ${formatBRL(saldoAnterior)}\n`;
      else if (saldoAnterior < 0) saldoAntStr = `➖ Adiantamentos Anteriores: ${formatBRL(Math.abs(saldoAnterior))}\n`;

      let discountsText = '';
      if (currentSettlement.extra_discounts_list && currentSettlement.extra_discounts_list.length > 0) {
          discountsText = currentSettlement.extra_discounts_list.map(d => `➖ ${d.reason || 'Desconto'}: ${formatBRL(d.amount)}`).join('\n') + '\n';
      } else if (currentSettlement.extra_discount > 0) {
          discountsText = `➖ Descontos Extras: ${formatBRL(currentSettlement.extra_discount)}\n`;
      }

      const compensationText = currentRenderDetails.compensation > 0.01 
          ? `➕ Quitação Dívida Passada: ${formatBRL(currentRenderDetails.compensation)}\n` 
          : '';

      const text = `*COMISSÃO* 💰\n` +
          `Vendedor: *${currentSellerName}*\n` +
          `Período: *${selectedMonthStr}*\n\n` +
          `📦 Total de Vendas: ${formatBRL(currentSettlement.total_sales)}\n` +
          `💵 Vendas (Dinheiro/Pix): ${formatBRL(currentSettlement.total_received)}\n` +
          `📊 Taxa de Comissão: ${currentSettlement.commission_rate}%\n` +
          `➕ Comissão Bruta: ${formatBRL(currentSettlement.commission_gross)}\n` +
          `➖ Consumo Próprio: ${formatBRL(currentSettlement.total_consumed)}\n` +
          discountsText +
          compensationText +
          `-----------------------------\n` +
          `💰 *Líquido do Mês: ${formatBRL(currentSettlement.final_payout)}*\n` +
          saldoAntStr +
          `\n*TOTAL GERAL DEVIDO: ${formatBRL(Math.max(0, currentTotalToPay))}*` +
          paymentsText +
          `\n\n-----------------------------\n` +
          `✅ *JÁ PAGO: ${formatBRL(currentSettlement.amount_paid || 0)}*\n` +
          (remaining > 0.01 ? `⚠️ *FALTA PAGAR: ${formatBRL(remaining)}*\n` : (remaining < -0.01 ? `🎉 *CRÉDITO DE ADIANTAMENTO: ${formatBRL(Math.abs(remaining))}*\n` : `🎉 *QUITADO!* \n`)) +
          `-----------------------------`;

      const link = `https://wa.me/?text=${encodeURIComponent(text)}`;
      window.open(link, '_blank');
  };

  const handlePrintHolerite = () => {
      if (!currentSettlement || !currentRenderDetails) return;
      
      const remaining = Number(currentSettlement.final_payout) + saldoAnterior - (currentSettlement.amount_paid || 0);
      
      let saldoAntStr = '';
      if (saldoAnterior > 0) saldoAntStr = `<div class="row"><span>(+) Saldo Anterior:</span><span>${formatBRL(saldoAnterior)}</span></div>`;
      else if (saldoAnterior < 0) saldoAntStr = `<div class="row"><span>(-) Adiantamentos:</span><span>${formatBRL(Math.abs(saldoAnterior))}</span></div>`;

      const htmlContent = commissionTemplate({
          sellerName: currentSellerName,
          monthName: selectedMonthStr,
          totalSales: formatBRL(currentSettlement.total_sales),
          totalReceivedCash: formatBRL(currentSettlement.total_received),
          commissionRate: currentSettlement.commission_rate,
          commissionGross: formatBRL(currentSettlement.commission_gross),
          totalConsumed: formatBRL(currentSettlement.total_consumed),
          extraDiscountsList: currentSettlement.extra_discounts_list || [],
          legacyExtraDiscount: currentSettlement.extra_discount,
          compensationApplied: currentRenderDetails.compensation,
          finalPayout: formatBRL(currentSettlement.final_payout),
          saldoAntStr,
          amountPaid: formatBRL(currentSettlement.amount_paid || 0),
          remainingLabel: remaining > 0.01 ? 'FALTA PAGAR' : 'CRÉDITO',
          remainingStr: formatBRL(Math.abs(remaining))
      });

      executePrint(htmlContent);
  };

  const generateThermalReport = () => {
    const periodStr = dateMode === 'month' ? `${monthsList[Number(selectedMonthStr.split('-')[1])-1]}/${selectedMonthStr.split('-')[0]}` : `${new Date(customStart).toLocaleDateString()} a ${new Date(customEnd).toLocaleDateString()}`;
    const ordersFormatted = filteredData.orders.map(o => ({ date: new Date(o.created_at).toLocaleDateString(), desc: `#${o.id.slice(0,4)}`, value: `${o.type === 'return' ? '-' : ''}${formatBRL(o.total)}` }));
    const paymentsFormatted = groupedPayments.map(p => ({ date: new Date(p.date).toLocaleDateString(), desc: p.isGroup ? `${p.method} (Lote)` : p.method, value: formatBRL(p.amount) }));
    const templateStats = { netSales: formatBRL(stats.netSales), commission: formatBRL(acertoPreview && activeSellerRole !== 'balcao' ? acertoPreview.commissionGross : 0), totalReceived: formatBRL(stats.totalReceived) };
    const htmlContent = reportTemplate({ periodStr, currentSellerName, stats: templateStats, orders: ordersFormatted, payments: paymentsFormatted, reportType });
    executePrint(htmlContent);
  };

  return (
    <div className="p-6 pb-24 space-y-6 animate-in fade-in font-bold min-h-screen bg-slate-50 print:bg-white print:p-0">
      
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3">
            <button onClick={() => navigate(isAdmin ? '/' : '/dashboard')} className="p-3 bg-white rounded-2xl shadow-sm"><ArrowLeft size={20}/></button>
            <h2 className="text-xl font-black text-slate-800 uppercase">Relatórios</h2>
        </div>
        {isAdmin && (
            <button onClick={generateThermalReport} className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl shadow-sm active:scale-90" title="Imprimir Relatório de Vendas">
                <Printer size={20}/>
            </button>
        )}
      </div>

      <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-50 space-y-4 print:hidden">
        <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Período</label>
                <div className="flex bg-slate-50 p-1 rounded-xl">
                    <button onClick={() => setDateMode('month')} className={`flex-1 py-2 rounded-lg text-xs font-bold ${dateMode === 'month' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400'}`}>Mês</button>
                    {isAdmin && <button onClick={() => setDateMode('custom')} className={`flex-1 py-2 rounded-lg text-xs font-bold ${dateMode === 'custom' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400'}`}>Data</button>}
                </div>
            </div>
            
            <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Operador / Vendedor</label>
                <div className="relative">
                    {isAdmin ? (
                        <button onClick={() => setShowSellerDropdown(!showSellerDropdown)} className="w-full p-3.5 bg-slate-50 rounded-2xl flex justify-between items-center text-left">
                            <span className={`font-bold text-xs truncate ${activeSeller === 'all' ? 'text-slate-400' : 'text-slate-800'}`}>{activeSeller === 'all' ? 'Todos' : currentSellerName}</span>
                            <Search size={14} className="text-slate-400 flex-shrink-0"/>
                        </button>
                    ) : (
                        <div className="w-full p-3.5 bg-slate-50 rounded-2xl flex justify-between items-center text-left">
                            <span className="font-bold text-xs text-indigo-600 truncate">{currentSellerName}</span>
                        </div>
                    )}

                    {showSellerDropdown && isAdmin && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 z-50 p-2 max-h-60 overflow-y-auto">
                            <input className="w-full p-3 bg-slate-50 rounded-xl font-bold text-sm mb-2 outline-none" placeholder="Buscar..." value={sellerSearch} onChange={e => setSellerSearch(e.target.value)} autoFocus />
                            <button onClick={() => { setSelectedSellerState('all'); setShowSellerDropdown(false); setSellerSearch(''); }} className="w-full p-3 rounded-xl text-left font-bold text-slate-500 hover:bg-slate-50">Todos</button>
                            {filteredSellers.map(s => (
                                <button key={s.id} onClick={() => { setSelectedSellerState(s.id); setShowSellerDropdown(false); setSellerSearch(''); }} className="w-full p-3 rounded-xl text-left font-bold text-slate-800 hover:bg-yellow-50">{s.name}</button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>

        {dateMode === 'month' ? (
            <div className="relative">
                <button onClick={() => setShowMonthPicker(!showMonthPicker)} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-slate-800 flex justify-between items-center">
                    <span className="capitalize">{monthsList[Number(selectedMonthStr.split('-')[1])-1]} <span className="text-slate-400">{selectedMonthStr.split('-')[0]}</span></span>
                    {showMonthPicker ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
                </button>
                {showMonthPicker && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white p-4 rounded-2xl shadow-xl border border-slate-100 z-40">
                        <div className="flex justify-between items-center mb-4">
                            <button onClick={() => setViewYear(viewYear - 1)} className="p-2 bg-slate-50 rounded-lg"><ChevronLeft size={16}/></button>
                            <span className="font-black text-slate-800">{viewYear}</span>
                            <button onClick={() => setViewYear(viewYear + 1)} className="p-2 bg-slate-50 rounded-lg"><ChevronRight size={16}/></button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            {monthsList.map((m, i) => {
                                const isSelected = selectedMonthStr === `${viewYear}-${String(i+1).padStart(2,'0')}`;
                                return (
                                    <button key={m} onClick={() => handleSelectMonth(i)} className={`py-2 rounded-lg text-xs font-bold ${isSelected ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-500'}`}>{m.substring(0,3)}</button>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>
        ) : (
            <div className="flex gap-2">
                <input type="date" className="flex-1 p-4 bg-slate-50 rounded-2xl font-bold text-xs outline-none" value={customStart} onChange={e => setCustomStart(e.target.value)} />
                <input type="date" className="flex-1 p-4 bg-slate-50 rounded-2xl font-bold text-xs outline-none" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
            </div>
        )}

        <div className="flex gap-2">
            {['orders', 'payments', 'full'].map(type => (
                <button key={type} onClick={() => setReportType(type)} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase border-2 transition-all ${reportType === type ? 'border-yellow-400 bg-yellow-50 text-yellow-700' : 'border-slate-50 bg-slate-50 text-slate-400'}`}>
                    {type === 'orders' ? 'Vendas' : type === 'payments' ? 'Pagamentos' : 'Completo'}
                </button>
            ))}
        </div>
      </div>

      {dateMode === 'month' && activeSeller !== 'all' && activeSellerRole === 'balcao' && balcaoTotals && (
          <div className="bg-white border-2 border-indigo-100 p-6 rounded-[2.5rem] space-y-4 shadow-lg shadow-indigo-50 mb-6 animate-in fade-in">
             <div className="flex justify-between items-center">
                 <p className="text-indigo-600 font-black uppercase text-xs tracking-widest flex items-center gap-2">
                     <Store size={16}/> Resumo do PDV / Balcão
                 </p>
                 <span className="px-2 py-1 bg-indigo-100 text-indigo-600 rounded text-[10px] font-black uppercase">Fechamento Base</span>
             </div>
             <p className="text-[10px] font-bold text-slate-400 leading-tight">
                 Como operador de caixa, este usuário não recebe comissão. Abaixo está o consolidado dos recebimentos dele no período selecionado.
             </p>
             
             <div className="space-y-3 mt-4">
                 <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                     <span className="text-xs font-bold text-slate-600 flex items-center gap-2"><Banknote size={16}/> Dinheiro</span>
                     <span className="font-mono font-black text-slate-800">{formatBRL(balcaoTotals['Dinheiro'])}</span>
                 </div>
                 <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                     <span className="text-xs font-bold text-slate-600 flex items-center gap-2"><QrCode size={16}/> Pix</span>
                     <span className="font-mono font-black text-slate-800">{formatBRL(balcaoTotals['Pix'])}</span>
                 </div>
                 <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                     <span className="text-xs font-bold text-slate-600 flex items-center gap-2"><CreditCard size={16}/> Cartão</span>
                     <span className="font-mono font-black text-slate-800">{formatBRL(balcaoTotals['Cartão'])}</span>
                 </div>
                 <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                     <span className="text-xs font-black uppercase text-orange-500">Pendente de Recebimento</span>
                     <span className="font-mono font-black text-orange-500">{formatBRL(balcaoTotals.pendente)}</span>
                 </div>
             </div>
          </div>
      )}

      {dateMode === 'month' && activeSeller !== 'all' && activeSellerRole !== 'balcao' && acertoPreview && (
          <div className="mb-6 animate-in fade-in">
              {currentSettlement ? (
                  <div className="bg-slate-800 text-white p-6 rounded-[2.5rem] space-y-4 shadow-xl relative overflow-hidden">
                      <div className="absolute -right-4 -top-4 bg-white/5 w-24 h-24 rounded-full blur-xl"></div>
                      
                      <div className="flex justify-between items-center relative z-10">
                          <p className="text-slate-300 font-black uppercase text-xs tracking-widest flex items-center gap-2">
                              <FileText size={16}/> Resumo da Comissão
                          </p>
                          <span className={`px-2 py-1 rounded text-[10px] font-black uppercase shadow-sm ${currentSettlement.status === 'paid' ? 'bg-emerald-500 text-white' : 'bg-amber-400 text-slate-900'}`}>
                              {currentSettlement.status === 'paid' ? 'Quitado' : 'Pendente'}
                          </span>
                      </div>

                      {discrepancyDetails?.needsUpdate && (
                          <div className="relative z-10 bg-rose-500/20 border border-rose-400 p-4 rounded-2xl space-y-3 mt-2 shadow-inner">
                              <div className="flex items-start gap-2">
                                  <AlertTriangle size={20} className="text-rose-400 flex-shrink-0 mt-0.5"/>
                                  <div>
                                      <p className="text-[11px] text-rose-200 leading-tight font-bold">
                                          ATENÇÃO: Houve novos pedidos ou pagamentos deste vendedor após o fechamento. O valor real da comissão mudou.
                                      </p>
                                  </div>
                              </div>
                              {isAdmin && (
                                  <button onClick={handleUpdateSettlement} disabled={isSavingAcerto} className="w-full py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-black uppercase text-[10px] flex items-center justify-center gap-2 transition-colors">
                                      {isSavingAcerto ? <Loader2 size={14} className="animate-spin"/> : <RefreshCw size={14}/>} Atualizar Valores Base (Preserva os Pagamentos)
                                  </button>
                              )}
                          </div>
                      )}
                      
                      <div className="space-y-1 mt-4 relative z-10 opacity-90">
                          <div className="flex justify-between text-xs font-bold text-slate-400"><span>Vendas Dinheiro/Pix:</span> <span>{formatBRL(currentSettlement.total_received)}</span></div>
                          <div className="flex justify-between text-xs font-black text-yellow-400 pt-1"><span>Comissão Bruta ({currentSettlement.commission_rate}%):</span> <span>{formatBRL(currentSettlement.commission_gross)}</span></div>
                          <div className="flex justify-between text-xs font-bold pt-1 text-slate-300"><span>(-) Consumo Próprio:</span> <span>{formatBRL(currentSettlement.total_consumed)}</span></div>
                          
                          {currentSettlement.extra_discounts_list && currentSettlement.extra_discounts_list.length > 0 ? (
                              currentSettlement.extra_discounts_list.map((d, i) => (
                                  <div key={i} className="flex justify-between text-xs font-bold text-rose-300 pt-1">
                                      <span>(-) {d.reason || 'Desconto Extra'}:</span> 
                                      <span>{formatBRL(d.amount)}</span>
                                  </div>
                              ))
                          ) : (
                              currentSettlement.extra_discount > 0 && (
                                  <div className="flex justify-between text-xs font-bold text-rose-300 pt-1">
                                      <span>(-) Descontos Extras:</span> 
                                      <span>{formatBRL(currentSettlement.extra_discount)}</span>
                                  </div>
                              )
                          )}

                          {currentRenderDetails.compensation > 0.01 && (
                              <div className="flex justify-between text-xs font-bold text-emerald-400 pt-1 border-t border-slate-600 mt-1">
                                  <span>(+) Quitação de Dívida Passada:</span> 
                                  <span>{formatBRL(currentRenderDetails.compensation)}</span>
                              </div>
                          )}
                          
                          <div className="flex justify-between font-bold text-slate-100 bg-white/10 p-2 mt-2 rounded-lg">
                              <span className="text-xs uppercase">Líquido Final do Mês:</span> <span className="font-mono">{formatBRL(currentSettlement.final_payout)}</span>
                          </div>

                          {saldoAnterior > 0.01 && (
                              <div className="flex justify-between text-xs text-amber-400 font-bold mt-2">
                                  <span>(+) Saldo Atrasado Anterior:</span>
                                  <span className="font-mono">{formatBRL(saldoAnterior)}</span>
                              </div>
                          )}
                          {saldoAnterior < -0.01 && (
                              <div className="flex justify-between text-xs text-red-400 font-bold mt-2">
                                  <span>(-) Adiantamentos Anteriores:</span>
                                  <span className="font-mono">{formatBRL(Math.abs(saldoAnterior))}</span>
                              </div>
                          )}

                          <div className="border-t border-slate-600 mt-3 pt-3 flex justify-between items-center">
                              <span className="font-black uppercase text-slate-300 text-[10px]">Total de Direito:</span>
                              <span className="font-mono text-xl font-black text-white">{formatBRL(Math.max(0, Number(currentSettlement.final_payout) + saldoAnterior))}</span>
                          </div>
                      </div>

                      <div className="bg-white text-slate-800 rounded-3xl p-5 relative z-10 space-y-3 mt-4">
                          <div className="flex justify-between items-center">
                              <h4 className="text-xs font-black uppercase text-slate-400">Pagamentos Efetuados</h4>
                              {isAdmin && currentSettlement.status !== 'paid' && (
                                  <button onClick={() => setShowPaymentForm(!showPaymentForm)} className="px-3 py-1.5 bg-green-100 text-green-700 rounded-xl text-[10px] font-black uppercase flex items-center gap-1 active:scale-90 transition-all">
                                      {showPaymentForm ? <X size={12}/> : <Plus size={12}/>} {showPaymentForm ? 'Fechar' : 'Adicionar'}
                                  </button>
                              )}
                          </div>

                          {showPaymentForm && isAdmin && (
                              <div className="bg-slate-50 p-3 rounded-2xl flex flex-col gap-2 border border-slate-200 animate-in slide-in-from-top-2">
                                  <div className="flex gap-2 w-full">
                                      <input type="date" className="w-1/3 min-w-0 p-3 bg-white rounded-xl text-xs font-bold outline-none border border-slate-100" value={payDate} onChange={e => setPayDate(e.target.value)} />
                                      <input type="number" className="flex-1 min-w-0 p-3 bg-white rounded-xl text-sm font-bold outline-none border border-slate-100 focus:border-green-400" placeholder="R$ Valor" value={payAmount} onChange={e => setPayAmount(e.target.value)} />
                                  </div>
                                  <button onClick={handleAddPayment} disabled={isSavingAcerto} className="w-full p-3 bg-green-500 text-white rounded-xl font-black uppercase text-xs flex justify-center items-center gap-2 active:scale-95 transition-transform">
                                      {isSavingAcerto ? <Loader2 size={16} className="animate-spin"/> : <><CheckCircle2 size={16}/> Confirmar Pagamento</>}
                                  </button>
                              </div>
                          )}

                          <div className="space-y-2">
                              {(currentSettlement.payments_history || []).length === 0 && <p className="text-[10px] text-slate-400 font-bold italic text-center py-2">Nenhum pagamento registrado.</p>}
                              
                              {(currentSettlement.payments_history || []).map(p => (
                                  <div key={p.id} className="flex justify-between items-center p-2 bg-slate-50 rounded-xl border border-slate-100">
                                      <div className="flex items-center gap-2">
                                          <div className={`w-6 h-6 rounded-full flex items-center justify-center ${p.is_auto ? 'bg-purple-100 text-purple-600' : 'bg-green-100 text-green-600'}`}><DollarSign size={12}/></div>
                                          <div>
                                              <span className="font-bold text-slate-700 block leading-tight">
                                                  {p.reason || 'Pagamento Manual'}
                                                  {p.is_auto && <span className="ml-2 text-[8px] bg-purple-100 text-purple-600 px-1 py-0.5 rounded uppercase">Auto</span>}
                                              </span>
                                              <span className="text-[9px] text-slate-400">{new Date(p.date).toLocaleDateString('pt-BR')}</span>
                                          </div>
                                      </div>
                                      <div className="flex items-center gap-3">
                                          <span className="font-mono font-black text-green-600">{formatBRL(p.amount)}</span>
                                          {isAdmin && !p.is_auto && <button onClick={() => handleRemovePayment(p.id)} className="text-red-300 hover:text-red-500 p-1"><Trash2 size={14}/></button>}
                                      </div>
                                  </div>
                              ))}
                          </div>

                          <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                              <span className="font-black uppercase text-[10px] text-slate-400">
                                  {(Number(currentSettlement.final_payout) + saldoAnterior - (currentSettlement.amount_paid || 0)) < -0.01 ? 'Crédito (Adiantamento)' : 'Falta Pagar'}
                              </span>
                              <span className={`font-mono text-xl font-black ${ (Number(currentSettlement.final_payout) + saldoAnterior - (currentSettlement.amount_paid || 0)) < 0.01 ? 'text-green-500' : 'text-red-500'}`}>
                                  {formatBRL(Math.abs(Number(currentSettlement.final_payout) + saldoAnterior - (currentSettlement.amount_paid || 0)))}
                              </span>
                          </div>
                      </div>

                      <div className="flex gap-2 pt-2 relative z-10">
                          {isAdmin && (
                              <button onClick={handleDeleteSettlement} disabled={isSavingAcerto} className="p-3 bg-white/10 text-red-300 rounded-2xl active:scale-95 transition-transform" title="Desfazer Fechamento do Mês">
                                  {isSavingAcerto ? <Loader2 className="animate-spin" size={20}/> : <Trash2 size={20}/>}
                              </button>
                          )}
                          {isAdmin && (
                              <button onClick={handlePrintHolerite} className="p-3 bg-white text-slate-900 rounded-2xl active:scale-95 transition-transform" title="Imprimir Recibo com Assinatura">
                                  <Printer size={20}/>
                              </button>
                          )}
                          <button onClick={handleShareHolerite} className="flex-1 py-3 bg-white text-slate-900 rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-2 active:scale-95 shadow-md">
                              <Share2 size={16}/> {isAdmin ? 'Enviar para Vendedor' : 'Compartilhar'}
                          </button>
                      </div>
                  </div>
              ) : (
                  <div className="bg-white border-2 border-indigo-100 p-6 rounded-[2.5rem] space-y-4 shadow-lg shadow-indigo-50">
                      <div className="flex justify-between items-center">
                          <p className="text-indigo-600 font-black uppercase text-xs tracking-widest flex items-center gap-2"><Calculator size={16}/> Prévia da Comissão</p>
                          <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded text-[10px] font-black uppercase">Não Fechado</span>
                      </div>

                      <div className="space-y-2 text-xs">
                          <div className="flex justify-between font-bold text-slate-500"><span>Vendas Dinheiro/Pix:</span> <span className="font-mono">{formatBRL(acertoPreview.totalReceivedCash)}</span></div>
                          <div className="flex justify-between font-black text-indigo-600 bg-indigo-50 p-2 rounded-lg">
                              <span>Comissão Bruta ({tempRate}%):</span> <span className="font-mono">{formatBRL(acertoPreview.commissionGross)}</span>
                          </div>
                          <div className="flex justify-between font-bold text-red-500"><span>(-) Consumo Próprio:</span> <span className="font-mono">{formatBRL(acertoPreview.totalConsumed)}</span></div>
                          
                          {extraDiscountsList.map((d, i) => (
                              Number(d.amount) > 0 && (
                                  <div key={i} className="flex justify-between font-bold text-rose-500 text-xs border-t border-slate-100 mt-1 pt-2">
                                      <span>(-) {d.reason || 'Desconto'}:</span> <span className="font-mono">{formatBRL(d.amount)}</span>
                                  </div>
                              )
                          ))}

                          {acertoPreview.compensationApplied > 0.01 && (
                              <div className="flex justify-between font-bold text-emerald-500 text-xs border-t border-slate-100 mt-1 pt-2">
                                  <span>(+) Quitação de Dívida Passada:</span> <span className="font-mono">{formatBRL(acertoPreview.compensationApplied)}</span>
                              </div>
                          )}

                          <div className="flex justify-between font-bold text-slate-800 bg-slate-100 p-2 mt-1 rounded-lg">
                              <span>Líquido Final do Mês:</span> <span className="font-mono">{formatBRL(acertoPreview.finalPayoutMonth)}</span>
                          </div>

                          {saldoAnterior > 0.01 && (
                              <div className="flex justify-between text-xs text-amber-600 font-bold mt-2">
                                  <span>(+) Saldo Atrasado Anterior:</span>
                                  <span className="font-mono">{formatBRL(saldoAnterior)}</span>
                              </div>
                          )}
                          {saldoAnterior < -0.01 && (
                              <div className="flex justify-between text-xs text-red-500 font-bold mt-2">
                                  <span>(-) Adiantamentos Anteriores:</span>
                                  <span className="font-mono">{formatBRL(Math.abs(saldoAnterior))}</span>
                              </div>
                          )}
                      </div>

                      {isAdmin && (
                          <div className="space-y-4 pt-3 border-t border-slate-100 mt-2">
                              <div className="space-y-1">
                                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Taxa de Comissão (%)</label>
                                  <input type="number" className="w-full p-3 bg-slate-50 rounded-xl font-bold outline-none" value={tempRate} onChange={e => setTempRate(e.target.value)} />
                              </div>
                              
                              <div className="bg-rose-50 p-3 rounded-2xl border border-rose-100 space-y-2">
                                  <div className="flex justify-between items-center ml-1">
                                      <label className="text-[10px] font-black text-rose-500 uppercase flex items-center gap-1">
                                          Descontos Extras
                                      </label>
                                      <button onClick={handleAddDiscount} className="text-[9px] font-black uppercase bg-rose-100 text-rose-600 px-2 py-1 rounded-lg flex items-center gap-1 active:scale-95">
                                          <Plus size={10}/> Adicionar
                                      </button>
                                  </div>
                                  
                                  {extraDiscountsList.length === 0 && (
                                      <p className="text-[9px] text-rose-400 font-bold italic text-center pb-1 pt-1">Nenhum desconto extra adicionado.</p>
                                  )}

                                  <div className="space-y-2">
                                      {extraDiscountsList.map((discount) => (
                                          <div key={discount.id} className="flex gap-2 animate-in slide-in-from-top-2">
                                              <input 
                                                  type="text" 
                                                  placeholder="Motivo (ex: Vale)"
                                                  className="flex-1 min-w-0 p-2 bg-white rounded-lg text-xs font-bold outline-none border border-rose-100 focus:border-rose-400"
                                                  value={discount.reason}
                                                  onChange={(e) => handleUpdateDiscount(discount.id, 'reason', e.target.value)}
                                              />
                                              <input 
                                                  type="number" 
                                                  placeholder="R$"
                                                  className="w-20 p-2 bg-white rounded-lg text-xs font-bold outline-none border border-rose-100 focus:border-rose-400"
                                                  value={discount.amount}
                                                  onChange={(e) => handleUpdateDiscount(discount.id, 'amount', e.target.value)}
                                              />
                                              <button onClick={() => handleRemoveDiscount(discount.id)} className="p-2 text-rose-400 hover:text-rose-600 bg-white rounded-lg border border-rose-100">
                                                  <Trash2 size={14}/>
                                              </button>
                                          </div>
                                      ))}
                                  </div>
                              </div>
                          </div>
                      )}

                      <div className="bg-slate-50 p-4 rounded-2xl flex justify-between items-center border border-slate-100 mt-2">
                          <span className="font-black text-slate-800 uppercase text-[10px] w-20">Total a Pagar</span>
                          <span className="font-mono text-3xl font-black text-slate-800">{formatBRL(Math.max(0, acertoPreview.totalToPay))}</span>
                      </div>

                      {isAdmin ? (
                          <button onClick={handleSaveSettlement} disabled={isSavingAcerto} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg mt-2">
                              {isSavingAcerto ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>} Fechar Mês & Iniciar Acerto
                          </button>
                      ) : (
                          <p className="text-center text-[10px] font-bold text-slate-400 uppercase mt-2">Aguardando fechamento do administrador para este mês.</p>
                      )}
                  </div>
              )}
          </div>
      )}

      <div className="space-y-3 print:hidden">
        {(reportType === 'full' || reportType === 'orders') && (
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-6 rounded-[2.5rem] text-white shadow-lg relative overflow-hidden">
                <div className="absolute -right-4 -top-4 bg-white/10 w-24 h-24 rounded-full blur-xl"></div>
                <div className="flex justify-between items-start relative z-10">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">Vendas Totais do Período</p>
                        <p className="text-3xl font-black font-mono tracking-tighter">{formatBRL(stats.netSales)}</p>
                        <p className="text-xs font-bold mt-1 opacity-90">{filteredData.orders.length} pedidos realizados</p>
                    </div>
                    <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm"><TrendingUp size={24} className="text-white"/></div>
                </div>
            </div>
        )}

        {(reportType === 'full' || reportType === 'payments') && (
            <div className="flex gap-3">
                <div className="flex-1 bg-white p-5 rounded-[2.5rem] border border-slate-100 shadow-sm">
                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Total Recebido (Caixa)</p>
                    <p className="text-xl font-black text-slate-800 font-mono tracking-tighter">{formatBRL(stats.totalReceived)}</p>
                </div>
            </div>
        )}
      </div>

      {(reportType !== 'payments' && stats.ranking.length > 0) && (
          <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-50 space-y-4 print:hidden">
            <h3 className="text-sm font-black text-slate-800 uppercase flex items-center gap-2"><PieChart size={16}/> Desempenho</h3>
            
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center font-black text-xs">1º</div>
                <div className="flex-1">
                    <p className="text-xs font-bold text-slate-800">{stats.ranking[0].name}</p>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full mt-1 overflow-hidden">
                        <div className="h-full bg-green-500 w-full"></div>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-xs font-black text-slate-800">{stats.ranking[0].qty} un</p>
                </div>
            </div>

            {expandRanking && stats.ranking.slice(1, -1).map((prod, idx) => (
                <div key={prod.name} className="flex items-center gap-3 animate-in fade-in">
                    <div className="w-8 text-center font-bold text-xs text-slate-300">#{idx + 2}</div>
                    <div className="flex-1">
                        <p className="text-xs font-bold text-slate-600">{prod.name}</p>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full mt-1 overflow-hidden">
                            <div className="h-full bg-slate-400" style={{ width: `${(prod.qty / stats.ranking[0].qty) * 100}%` }}></div>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-xs font-bold text-slate-500">{prod.qty} un</p>
                    </div>
                </div>
            ))}

            {stats.ranking.length > 1 && (
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-red-50 text-red-400 flex items-center justify-center font-black text-xs">▼</div>
                    <div className="flex-1">
                        <p className="text-xs font-bold text-slate-800">{stats.ranking[stats.ranking.length - 1].name}</p>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full mt-1 overflow-hidden">
                            <div className="h-full bg-red-400" style={{ width: `${(stats.ranking[stats.ranking.length - 1].qty / stats.ranking[0].qty) * 100}%` }}></div>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-xs font-black text-slate-800">{stats.ranking[stats.ranking.length - 1].qty} un</p>
                    </div>
                </div>
            )}

            {stats.ranking.length > 2 && (
                <button onClick={() => setExpandRanking(!expandRanking)} className="w-full py-3 bg-slate-50 text-slate-400 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-1 active:bg-slate-100">
                    {expandRanking ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                    {expandRanking ? 'Recolher Ranking' : `Ver mais ${stats.ranking.length - 2} produtos`}
                </button>
            )}
          </div>
      )}

      <div className="space-y-4 pt-4 border-t border-slate-100 print:border-black">
        <h3 className="text-sm font-black text-slate-800 print:text-black uppercase ml-2 flex items-center gap-2"><FileText size={16}/> Extrato Detalhado</h3>
        
        {(reportType !== 'payments') && filteredData.orders.map(o => (
            <div key={o.id} className="bg-white p-4 rounded-[1.5rem] border border-slate-50 flex justify-between items-center text-xs shadow-sm">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-indigo-500 bg-indigo-50 px-1.5 rounded">#{o.id.slice(0,4)}</span>
                        <span className="font-black text-slate-800">
                            {new Date(o.created_at).toLocaleDateString('pt-BR')} às {new Date(o.created_at).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}
                        </span>
                    </div>
                    <p className="text-slate-500 font-bold mt-1 text-[10px] uppercase">
                        Operador: {o.seller_name} • {o.order_items?.length || 0} itens
                    </p>
                    {o.payment_method && (
                        <p className="text-slate-400 font-bold mt-0.5 text-[10px] uppercase">
                            Pagamento: {o.payment_method}
                        </p>
                    )}
                </div>
                <p className={`font-mono font-black ${o.type === 'return' ? 'text-red-400' : 'text-slate-800'}`}>
                    {o.type === 'return' ? '-' : ''}{formatBRL(o.total)}
                </p>
            </div>
        ))}

        {(reportType !== 'orders') && groupedPayments.map((p, idx) => (
            <div key={p.id || idx} className="bg-white p-4 rounded-[1.5rem] border border-green-50 flex justify-between items-center text-xs shadow-sm">
                <div>
                    <p className="font-black text-green-800">{new Date(p.date).toLocaleDateString()} - Pagamento</p>
                    <p className="text-green-600 font-bold mt-0.5">
                        {p.method} 
                        {p.isGroup ? ' (Lote Agrupado)' : ''} 
                        {p.description ? ` - ${p.description}` : ''}
                    </p>
                </div>
                <p className="font-mono font-black text-green-600">
                    {formatBRL(p.amount)}
                </p>
            </div>
        ))}

        {(filteredData.orders.length === 0 && groupedPayments.length === 0) && (
            <p className="text-center text-slate-400 text-xs py-8">Nada encontrado.</p>
        )}
      </div>
    </div>
  );
};

export default Reports;