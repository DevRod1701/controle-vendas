import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    ArrowLeft, PieChart, TrendingUp, FileText, Printer, Search, ChevronLeft, ChevronRight, ChevronDown, ChevronUp
} from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { formatBRL } from '../../utils/formatters';
import { executePrint } from '../../utils/printHandler';

// IMPORTANTE: Certifique-se que o reportTemplate.js está nesta pasta (igual ao orderDetailTemplate)
import { reportTemplate } from '../../utils/print/reportTemplate'; 

const Reports = () => {
  const navigate = useNavigate();
  const { orders, payments } = useData();

  // Estados dos Filtros
  const [dateMode, setDateMode] = useState('month'); // 'month' | 'custom'
  
  // Controle do Mês Customizado (Visual)
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [selectedMonthStr, setSelectedMonthStr] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [showMonthPicker, setShowMonthPicker] = useState(false); // Toggle do menu de meses

  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  
  // Controle de Vendedor (Busca)
  const [selectedSeller, setSelectedSeller] = useState('all');
  const [sellerSearch, setSellerSearch] = useState('');
  const [showSellerDropdown, setShowSellerDropdown] = useState(false);

  // Tipo de Relatório e Visualização
  const [reportType, setReportType] = useState('full'); 
  const [expandRanking, setExpandRanking] = useState(false); // Toggle do Ranking

  // --- FUNÇÕES AUXILIARES ---
  const monthsList = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

  const handleSelectMonth = (monthIndex) => {
    const m = String(monthIndex + 1).padStart(2, '0');
    setSelectedMonthStr(`${viewYear}-${m}`);
    setShowMonthPicker(false); // Fecha ao selecionar
  };

  // --- LÓGICA DE FILTRAGEM ---
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

    // Filtra Pedidos
    const filteredOrders = orders.filter(o => {
        const d = new Date(o.created_at);
        const matchDate = d >= start && d <= end;
        const matchSeller = selectedSeller === 'all' || o.seller_id === selectedSeller;
        const matchStatus = o.status === 'approved'; 
        return matchDate && matchSeller && matchStatus;
    });

    // Filtra Pagamentos
    const filteredPayments = payments.filter(p => {
        const originalOrder = orders.find(o => o.id === p.order_id);
        const referenceDate = originalOrder ? new Date(originalOrder.created_at) : new Date(p.date + 'T12:00:00');
        const matchDate = referenceDate >= start && referenceDate <= end;
        const matchSeller = selectedSeller === 'all' || (originalOrder && originalOrder.seller_id === selectedSeller);
        return matchDate && matchSeller;
    });

    return { orders: filteredOrders, payments: filteredPayments, startDate: start, endDate: end };
  }, [orders, payments, selectedMonthStr, customStart, customEnd, dateMode, selectedSeller]);

  // --- ESTATÍSTICAS ---
  const stats = useMemo(() => {
    const totalSales = filteredData.orders.reduce((acc, o) => acc + (o.type === 'sale' ? Number(o.total) : 0), 0);
    const totalReturnsValue = filteredData.orders.reduce((acc, o) => acc + (o.type === 'return' ? Number(o.total) : 0), 0);
    const totalReceived = filteredData.payments.reduce((acc, p) => acc + Number(p.amount), 0);
    const netSales = totalSales; 
    const commission = netSales * 0.20;

    // Análise de Produtos
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

    return {
        totalSales,
        totalReturnsValue,
        netSales,
        totalReceived,
        commission,
        ranking: rankedProducts
    };
  }, [filteredData]);

  // Lista de Vendedores
  const sellersList = useMemo(() => {
    const unique = new Set();
    const list = [];
    orders.forEach(o => {
        if (o.seller_id && !unique.has(o.seller_id)) {
            unique.add(o.seller_id);
            list.push({ id: o.seller_id, name: o.seller_name || 'Vendedor Desconhecido' });
        }
    });
    return list;
  }, [orders]);

  const filteredSellers = sellersList.filter(s => s.name.toLowerCase().includes(sellerSearch.toLowerCase()));
  const currentSellerName = selectedSeller === 'all' ? 'Todos os Vendedores' : sellersList.find(s => s.id === selectedSeller)?.name || 'Vendedor';

  
  // --- FUNÇÃO DE IMPRESSÃO TÉRMICA (ATUALIZADA) ---
  const generateThermalReport = () => {
    const periodStr = dateMode === 'month' 
        ? `${monthsList[Number(selectedMonthStr.split('-')[1])-1]}/${selectedMonthStr.split('-')[0]}` 
        : `${new Date(customStart).toLocaleDateString()} a ${new Date(customEnd).toLocaleDateString()}`;

    // 1. PREPARAÇÃO DOS PEDIDOS
    const ordersFormatted = filteredData.orders.map(o => ({
        date: new Date(o.created_at).toLocaleDateString(),
        desc: `#${o.id.slice(0,4)}`,
        value: `${o.type === 'return' ? '-' : ''}${formatBRL(o.total)}`
    }));

    // 2. PREPARAÇÃO DOS PAGAMENTOS
    const paymentsFormatted = filteredData.payments.map(p => ({
        date: new Date(p.date).toLocaleDateString(),
        desc: p.method, // Ex: "Pix", "Dinheiro"
        value: formatBRL(p.amount)
    }));

    // 3. TOTAIS
    const templateStats = {
        netSales: formatBRL(stats.netSales),
        commission: formatBRL(stats.commission),
        totalReceived: formatBRL(stats.totalReceived)
    };

    // 4. GERA O HTML (Passando listas separadas)
    const htmlContent = reportTemplate({
        periodStr,
        currentSellerName,
        stats: templateStats,
        orders: ordersFormatted,      // Lista separada de pedidos
        payments: paymentsFormatted,  // Lista separada de pagamentos
        reportType: reportType
    });

    // 5. IMPRIME
    executePrint(htmlContent);
  };

  return (
    <div className="p-6 pb-24 space-y-6 animate-in fade-in font-bold min-h-screen bg-slate-50 print:bg-white print:p-0">
      
      {/* CABEÇALHO */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="p-3 bg-white rounded-2xl shadow-sm"><ArrowLeft size={20}/></button>
            <h2 className="text-xl font-black text-slate-800 uppercase">Relatórios</h2>
        </div>
        <button onClick={generateThermalReport} className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl shadow-sm active:scale-90">
            <Printer size={20}/>
        </button>
      </div>

      {/* ÁREA DE FILTROS */}
      <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-50 space-y-4 print:hidden">
        
        {/* Vendedor e Período */}
        <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Período</label>
                <div className="flex bg-slate-50 p-1 rounded-xl">
                    <button onClick={() => setDateMode('month')} className={`flex-1 py-2 rounded-lg text-xs font-bold ${dateMode === 'month' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400'}`}>Mês</button>
                    <button onClick={() => setDateMode('custom')} className={`flex-1 py-2 rounded-lg text-xs font-bold ${dateMode === 'custom' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400'}`}>Data</button>
                </div>
            </div>
            
            <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Vendedor</label>
                <div className="relative">
                    <button 
                        onClick={() => setShowSellerDropdown(!showSellerDropdown)}
                        className="w-full p-3.5 bg-slate-50 rounded-2xl flex justify-between items-center text-left"
                    >
                        <span className={`font-bold text-xs truncate ${selectedSeller === 'all' ? 'text-slate-400' : 'text-slate-800'}`}>
                            {selectedSeller === 'all' ? 'Todos' : currentSellerName}
                        </span>
                        <Search size={14} className="text-slate-400 flex-shrink-0"/>
                    </button>

                    {showSellerDropdown && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 z-50 p-2 max-h-60 overflow-y-auto">
                            <input 
                                className="w-full p-3 bg-slate-50 rounded-xl font-bold text-sm mb-2 outline-none"
                                placeholder="Buscar..."
                                value={sellerSearch}
                                onChange={e => setSellerSearch(e.target.value)}
                                autoFocus
                            />
                            <button onClick={() => { setSelectedSeller('all'); setShowSellerDropdown(false); setSellerSearch(''); }} className="w-full p-3 rounded-xl text-left font-bold text-slate-500 hover:bg-slate-50">Todos</button>
                            {filteredSellers.map(s => (
                                <button key={s.id} onClick={() => { setSelectedSeller(s.id); setShowSellerDropdown(false); setSellerSearch(''); }} className="w-full p-3 rounded-xl text-left font-bold text-slate-800 hover:bg-yellow-50">{s.name}</button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* Seleção de Datas */}
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

        {/* Filtro de Tipo */}
        <div className="flex gap-2">
            {['orders', 'payments', 'full'].map(type => (
                <button 
                    key={type}
                    onClick={() => setReportType(type)}
                    className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase border-2 transition-all ${reportType === type ? 'border-yellow-400 bg-yellow-50 text-yellow-700' : 'border-slate-50 bg-slate-50 text-slate-400'}`}
                >
                    {type === 'orders' ? 'Vendas' : type === 'payments' ? 'Pagamentos' : 'Completo'}
                </button>
            ))}
        </div>
      </div>

      {/* --- CARDS DE TOTAIS --- */}
      <div className="space-y-3 print:hidden">
        {(reportType === 'full' || reportType === 'orders') && (
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-6 rounded-[2.5rem] text-white shadow-lg shadow-green-100 relative overflow-hidden">
                <div className="absolute -right-4 -top-4 bg-white/20 w-24 h-24 rounded-full blur-xl"></div>
                <div className="flex justify-between items-start relative z-10">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">Vendas Líquidas</p>
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
                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Total Recebido</p>
                    <p className="text-xl font-black text-slate-800 font-mono tracking-tighter">{formatBRL(stats.totalReceived)}</p>
                </div>
                {/* COMISSÃO EM DESTAQUE */}
                <div className="flex-1 bg-indigo-600 p-5 rounded-[2.5rem] text-white shadow-lg shadow-indigo-100">
                    <p className="text-[9px] font-black uppercase tracking-widest opacity-80 mb-1">Comissão (20%)</p>
                    <p className="text-xl font-black font-mono tracking-tighter">{formatBRL(stats.commission)}</p>
                </div>
            </div>
        )}
      </div>

      {/* --- RANKING DE PRODUTOS --- */}
      {(reportType !== 'payments' && stats.ranking.length > 0) && (
          <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-50 space-y-4 print:hidden">
            <h3 className="text-sm font-black text-slate-800 uppercase flex items-center gap-2"><PieChart size={16}/> Desempenho</h3>
            
            {/* Top 1 */}
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

            {/* Lista Expandida */}
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

            {/* Último */}
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

            {/* Botão Expandir */}
            {stats.ranking.length > 2 && (
                <button 
                    onClick={() => setExpandRanking(!expandRanking)}
                    className="w-full py-3 bg-slate-50 text-slate-400 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-1 active:bg-slate-100"
                >
                    {expandRanking ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                    {expandRanking ? 'Recolher Ranking' : `Ver mais ${stats.ranking.length - 2} produtos`}
                </button>
            )}
          </div>
      )}

      {/* --- EXTRATO DETALHADO --- */}
      <div className="space-y-4 pt-4 border-t border-slate-100 print:border-black">
        <h3 className="text-sm font-black text-slate-800 print:text-black uppercase ml-2 flex items-center gap-2"><FileText size={16}/> Extrato Detalhado</h3>
        
        {/* LISTA DE PEDIDOS */}
        {(reportType !== 'payments') && filteredData.orders.map(o => (
            <div key={o.id} className="bg-white p-4 rounded-[1.5rem] border border-slate-50 flex justify-between items-center text-xs shadow-sm">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-indigo-500 bg-indigo-50 px-1.5 rounded">#{o.id.slice(0,4)}</span>
                        <span className="font-black text-slate-800">{new Date(o.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-slate-400 font-bold mt-1">
                        {o.seller_name} • {o.order_items.length} itens
                    </p>
                </div>
                <p className={`font-mono font-black ${o.type === 'return' ? 'text-red-400' : 'text-slate-800'}`}>
                    {o.type === 'return' ? '-' : ''}{formatBRL(o.total)}
                </p>
            </div>
        ))}

        {/* LISTA DE PAGAMENTOS */}
        {(reportType !== 'orders') && filteredData.payments.map(p => {
             const originalOrder = orders.find(o => o.id === p.order_id);
             const refDate = originalOrder ? new Date(originalOrder.created_at) : new Date(p.date + 'T12:00:00');

            return (
            <div key={p.id} className="bg-white p-4 rounded-[1.5rem] border border-green-50 flex justify-between items-center text-xs shadow-sm">
                <div>
                    <p className="font-black text-green-800">{new Date(p.date).toLocaleDateString()} - Pagamento</p>
                    <p className="text-green-600 font-bold mt-0.5">{p.method} {p.description ? `(${p.description})` : ''}</p>
                    {originalOrder && (
                        <p className="text-[9px] text-slate-400 mt-1">Ref. Pedido: {refDate.toLocaleDateString()}</p>
                    )}
                </div>
                <p className="font-mono font-black text-green-600">
                    {formatBRL(p.amount)}
                </p>
            </div>
        )})}

        {(filteredData.orders.length === 0 && filteredData.payments.length === 0) && (
            <p className="text-center text-slate-400 text-xs py-8">Nada encontrado.</p>
        )}
      </div>
    </div>
  );
};

export default Reports;