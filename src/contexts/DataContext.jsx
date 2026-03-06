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
  const [customers, setCustomers] = useState([]);
  const [customerTransactions, setCustomerTransactions] = useState([]);
  
  // NOVO ESTADO: Acertos de Comissão
  const [settlements, setSettlements] = useState([]);
  
  const [loading, setLoading] = useState(true);

  const refreshData = async () => {
    if (!session?.user) return;

    setLoading(true);
    try {
        // Produtos
        const { data: prodData } = await supabase.from('products').select('*').order('name');
        if (prodData) setProducts(prodData);

        // Pedidos
        const { data: orderData } = await supabase
            .from('orders')
            .select('*, order_items(*)')
            .order('created_at', { ascending: false })
            .limit(5000); 
        if (orderData) setOrders(orderData);

        // Pagamentos
        const { data: payData } = await supabase
            .from('payments')
            .select('id, amount, date, method, description, status, order_id, approver_name, has_proof') 
            .order('date', { ascending: false })
            .limit(5000);
        if (payData) setPayments(payData);

        // Clientes
        const { data: custData } = await supabase.from('customers').select('*').order('name');
        if (custData) setCustomers(custData);

        // Transações
        const { data: transData } = await supabase
            .from('customer_transactions')
            .select('*')
            .order('date', { ascending: false })
            .limit(10000);
        if (transData) setCustomerTransactions(transData);

        // NOVO: Acertos de Comissão
        const { data: settlementData } = await supabase
            .from('seller_settlements')
            .select('*')
            .order('month', { ascending: false });
        if (settlementData) setSettlements(settlementData);

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
        customers, 
        customerTransactions, 
        settlements, // <--- ADICIONADO AQUI
        refreshData, 
        loading 
    }}>
      {children}
    </DataContext.Provider>
  );
};