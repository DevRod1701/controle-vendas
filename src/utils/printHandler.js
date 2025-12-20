import { formatBRL } from './formatters';

export const printOrder = (order) => {
  const date = new Date(order.created_at).toLocaleString('pt-BR');
  
  const itemsHtml = order.order_items.map(item => `
    <div style="display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 14px; font-weight: bold;">
        <span style="flex: 1;">${item.qty}x ${item.name}</span>
        <span style="white-space: nowrap;">${formatBRL(item.price * item.qty)}</span>
    </div>
    ${item.qty === 0 ? '<div style="font-size: 12px; text-decoration: line-through; color: #000;">(Item Devolvido)</div>' : ''}
  `).join('');

  const content = `
    <html>
      <head>
        <title>Pedido #${order.id.slice(0, 5)}</title>
        <style>
          /* Configuração CRÍTICA para impressoras térmicas */
          @page { 
            size: 58mm auto; 
            margin: 0; 
          }
          
          body { 
            font-family: 'Courier New', monospace; 
            width: 58mm; /* Força a largura do papel */
            margin: 0; 
            padding: 2px 2px 20px 2px; /* Margemzinha de segurança */
            color: #000;
            font-size: 14px; /* Aumentei a base */
            line-height: 1.2;
          }

          h2 { font-size: 22px; text-align: center; margin: 5px 0; font-weight: 900; }
          p { margin: 2px 0; text-align: center; }
          
          .divider { border-top: 2px dashed #000; margin: 10px 0; }
          
          .info { font-size: 14px; margin-bottom: 10px; }
          
          .total-section { 
            font-size: 20px; 
            font-weight: 900; 
            text-align: right; 
            margin-top: 10px; 
          }
          
          .footer { 
            font-size: 12px; 
            text-align: center; 
            margin-top: 20px; 
            font-weight: bold;
          }
          
          /* Ajuste para itens ficarem alinhados */
          .row { display: flex; justify-content: space-between; }
        </style>
      </head>
      <body>
        <h2>MEU PUDINZINHO</h2>
        <p style="font-size: 12px;">Controle Interno</p>
        
        <div class="divider"></div>
        
        <div class="info">
          <p style="text-align: left;"><strong>Vend:</strong> ${order.seller_name}</p>
          <p style="text-align: left;"><strong>Data:</strong> ${date}</p>
          <p style="text-align: left;"><strong>Ped:</strong> #${order.id.slice(0, 5)}</p>
        </div>

        <div class="divider"></div>
        
        <div>
            ${itemsHtml}
        </div>

        <div class="divider"></div>
        
        <div class="total-section">
            TOTAL: ${formatBRL(order.total)}
        </div>
        
        <div style="text-align: right; margin-top: 5px; font-size: 14px; font-weight: bold;">
            Pago: ${formatBRL(order.paid || 0)}<br/>
            ${(order.total - (order.paid || 0)) > 0.01 
                ? `<span style="font-size: 16px;">Falta: ${formatBRL(order.total - (order.paid||0))}</span>` 
                : 'STATUS: QUITADO'}
        </div>

        <div class="footer">
            *** SEM VALOR FISCAL ***
        </div>
        
        <script>
            // Aguarda carregar e manda imprimir
            window.onload = function() {
                window.print();
                // Opcional: fecha a janela depois de imprimir (alguns navegadores bloqueiam)
                // setTimeout(function(){ window.close(); }, 500);
            }
        </script>
      </body>
    </html>
  `;

  // Configurações da janela popup para simular o tamanho do papel
  const win = window.open('', '', 'width=300,height=600');
  win.document.write(content);
  win.document.close();
};