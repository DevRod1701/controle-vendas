import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from './AuthContext';

const DataContext = createContext({});

export const DataProvider = ({ children }) => {
  const { session } = useAuth();
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loadingData, setLoadingData] = useState(false);

  const loadData = useCallback(async () => {
    if (!session) return;
    setLoadingData(true);
    
    const { data: pData } = await supabase.from('products').select('*').order('name');
    if (pData) setProducts(pData);

    const { data: oData } = await supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false });
    if (oData) setOrders(oData);

    const { data: payData } = await supabase.from('payments').select('*').order('date', { ascending: false });
    if (payData) setPayments(payData);
    
    setLoadingData(false);
  }, [session]);

  useEffect(() => {
    if (session) {
      loadData();

      // --- ATUALIZAÇÃO EM TEMPO REAL ---
      // Escuta qualquer mudança nas tabelas e recarrega os dados automaticamente
      const channel = supabase
        .channel('db-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => loadData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => loadData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => loadData())
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
  }, [session, loadData]);

  return (
    <DataContext.Provider value={{ products, orders, payments, loadingData, refreshData: loadData }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => useContext(DataContext);