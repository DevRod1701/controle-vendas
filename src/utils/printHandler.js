import { formatBRL } from './formatters';

export const printOrder = (order) => {
  // Calcula o troco ou restante se necessário, ou apenas formata
  const date = new Date(order.created_at).toLocaleString('pt-BR');
  
  const itemsHtml = order.order_items.map(item => `
    <div style="display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 12px;">
        <span>${item.qty}x ${item.name}</span>
        <span>${formatBRL(item.price * item.qty)}</span>
    </div>
    ${item.qty === 0 ? '<div style="font-size: 10px; text-decoration: line-through; color: #999;">(Item Devolvido)</div>' : ''}
  `).join('');

  const content = `
    <html>
      <head>
        <title>Pedido #${order.id.slice(0, 5)}</title>
        <style>
          body { font-family: 'Courier New', Courier, monospace; width: 300px; margin: 0; padding: 20px; color: #000; }
          h2, h3, p { margin: 0; text-align: center; }
          .divider { border-top: 1px dashed #000; margin: 10px 0; }
          .info { font-size: 12px; margin-bottom: 10px; }
          .total { font-size: 16px; font-weight: bold; text-align: right; margin-top: 10px; }
          .footer { font-size: 10px; text-align: center; margin-top: 20px; }
        </style>
      </head>
      <body>
        <h2>MEU PUDINZINHO</h2>
        <p style="font-size: 10px;">Controle Interno de Vendas</p>
        <div class="divider"></div>
        
        <div class="info">
          <p><strong>Vendedor:</strong> ${order.seller_name}</p>
          <p><strong>Data:</strong> ${date}</p>
          <p><strong>Pedido:</strong> #${order.id.slice(0, 5)}</p>
        </div>

        <div class="divider"></div>
        
        <div>
            ${itemsHtml}
        </div>

        <div class="divider"></div>
        
        <div class="total">
            TOTAL: ${formatBRL(order.total)}
        </div>
        
        <div class="info" style="text-align: right; margin-top: 5px;">
            Pago: ${formatBRL(order.paid || 0)}<br/>
            ${(order.total - (order.paid || 0)) > 0.01 ? `<strong>Falta: ${formatBRL(order.total - (order.paid||0))}</strong>` : 'STATUS: QUITADO'}
        </div>

        <div class="footer">
            Documento sem valor fiscal.<br/>
            Conferência interna.
        </div>
        
        <script>
            window.print();
        </script>
      </body>
    </html>
  `;

  const win = window.open('', '', 'height=600,width=400');
  win.document.write(content);
  win.document.close();
};