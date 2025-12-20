import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from './AuthContext';

const DataContext = createContext();

export const useData = () => useContext(DataContext);

export const DataProvider = ({ children }) => {
  const { session } = useAuth();
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [payments, setPayments] = useState([]);
  
  // NOVOS ESTADOS
  const [customers, setCustomers] = useState([]);
  const [customerTransactions, setCustomerTransactions] = useState([]);
  
  const [loading, setLoading] = useState(true);

  const refreshData = async () => {
    if (!session?.user) return;

    setLoading(true);
    try {
        // Busca Produtos
        const { data: prodData } = await supabase.from('products').select('*').order('name');
        if (prodData) setProducts(prodData);

        // Busca Pedidos (Lógica existente)
        let orderQuery = supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false });
        const { data: orderData } = await orderQuery;
        if (orderData) setOrders(orderData);

        // Busca Pagamentos Gerais
        const { data: payData } = await supabase.from('payments').select('*').order('date', { ascending: false });
        if (payData) setPayments(payData);

        // --- NOVO: BUSCA CLIENTES E TRANSAÇÕES DO VENDEDOR ---
        const { data: custData } = await supabase.from('customers').select('*').order('name');
        if (custData) setCustomers(custData);

        const { data: transData } = await supabase.from('customer_transactions').select('*').order('date', { ascending: false });
        if (transData) setCustomerTransactions(transData);

    } catch (error) {
        console.error("Erro ao carregar dados:", error);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, [session]);

  return (
    <DataContext.Provider value={{ 
        products, 
        orders, 
        payments, 
        customers, // Exportando
        customerTransactions, // Exportando
        refreshData, 
        loading 
    }}>
      {children}
    </DataContext.Provider>
  );
};