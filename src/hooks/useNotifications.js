import { useState, useEffect, useRef } from 'react';

export const useNotifications = (pendingCount) => {
  const [permission, setPermission] = useState(Notification.permission);
  const prevCountRef = useRef(pendingCount);

  // Pede permissão ao utilizador (necessário clique)
  const requestPermission = async () => {
    if (!('Notification' in window)) {
      alert("Este navegador não suporta notificações.");
      return;
    }
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === 'granted') {
      new Notification("Pudinzinho App", { 
        body: "Notificações ativadas com sucesso! 🍮",
        icon: '/logo.png'
      });
    }
  };

  // Monitoriza mudanças na contagem
  useEffect(() => {
    if (permission === 'granted' && pendingCount > prevCountRef.current) {
       // Só notifica se o número AUMENTOU (novos pedidos)
       const diff = pendingCount - prevCountRef.current;
       if (diff > 0) {
         try {
           new Notification("Atenção Admin 🔔", {
             body: `Você tem ${diff} novo(s) item(ns) aguardando aprovação.`,
             icon: '/logo.png',
             vibrate: [200, 100, 200]
           });
         } catch (e) {
           console.error("Erro ao notificar:", e);
         }
       }
    }
    // Atualiza a referência para a próxima comparação
    prevCountRef.current = pendingCount;
  }, [pendingCount, permission]);

  return { permission, requestPermission };
};