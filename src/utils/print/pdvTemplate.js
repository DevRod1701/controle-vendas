import { formatBRL } from '../formatters';

export const pdvTemplate = ({ order, items, customerInfo, isDelivery }) => {
    const isPreOrder = order.metadata?.is_pre_order;
    const paid = Number(order.paid || 0);
    const total = Number(order.total || 0);
    const pending = Math.max(0, total - paid);

    const styles = `
      @page { size: 80mm auto; margin: 0; }
      body { 
          font-family: 'Courier New', monospace; 
          width: 80mm; 
          margin: 0; 
          padding: 5px; 
          color: #000; 
          font-size: 13px; 
          line-height: 1.2;
          font-weight: bold;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
      }
      h1 { font-size: 16px; text-align: center; margin: 5px 0 0 0; font-weight: 900; }
      h2 { font-size: 14px; text-align: center; margin: 2px 0 10px 0; font-weight: 900; }
      .divider { border-top: 1px dashed #000; margin: 6px 0; }
      .divider-thick { border-top: 2px solid #000; margin: 8px 0; }
      .row { display: flex; justify-content: space-between; margin-bottom: 2px; }
      .text-center { text-align: center; }
      .bold { font-weight: 900; }
      .total { font-size: 16px; font-weight: 900; text-align: right; margin-top: 5px; }
      .item-row { display: flex; flex-direction: column; margin-bottom: 4px; }
      .item-header { display: flex; justify-content: space-between; }
      .item-desc { font-size: 10px; margin-left: 10px; }
      .close-btn { width: 100%; padding: 10px; background: #000; color: #fff; text-align: center; margin-bottom: 10px; cursor: pointer; border: none; font-weight: bold; }
      .bg-black { background-color: #000 !important; color: #fff !important; }
      .bg-gray { background-color: #eee !important; border: 1px solid #000; }
      @media print { .close-btn { display: none; } }
    `;

    const itemsHtml = items.map(item => `
      <div class="item-row">
          <div class="item-header">
              <span>${item.qty}x ${item.name}</span>
              <span>${formatBRL(item.price * item.qty)}</span>
          </div>
          <div class="item-desc">Un: ${formatBRL(item.price)}</div>
      </div>
    `).join('');

    // Define o cabeçalho do pedido (se é encomenda, delivery ou balcão)
    let headerTypeHtml = '';
    if (isPreOrder) {
        headerTypeHtml = `<div class="text-center bold bg-gray" style="font-size: 14px; padding: 4px 0;">ENCOMENDA ${isDelivery ? '(DELIVERY)' : '(RETIRADA)'}</div>`;
    } else {
        headerTypeHtml = isDelivery 
            ? `<div class="text-center bold bg-black" style="font-size: 14px; padding: 4px 0;">DELIVERY</div>`
            : `<div class="text-center bold bg-gray" style="font-size: 14px; padding: 4px 0;">RETIRADA BALCÃO</div>`;
    }

    const addressHtml = isDelivery && customerInfo ? `
      <div class="divider"></div>
      ${headerTypeHtml}
      <div style="margin-top: 5px;">
        <div><span class="bold">Cliente:</span> ${customerInfo.name || 'Não informado'}</div>
        <div><span class="bold">Tel:</span> ${customerInfo.phone || 'Não informado'}</div>
        <div style="margin-top: 4px;"><span class="bold">Endereço:</span></div>
        <div>${customerInfo.street || ''}, ${customerInfo.number || ''}</div>
        <div>${customerInfo.neighborhood || ''}</div>
        ${customerInfo.complement ? `<div><span class="bold">Comp:</span> ${customerInfo.complement}</div>` : ''}
      </div>
    ` : `
      <div class="divider"></div>
      ${headerTypeHtml}
      <div style="margin-top: 5px;">
        <div><span class="bold">Cliente:</span> ${customerInfo?.name || 'Cliente Balcão'}</div>
      </div>
    `;

    return `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <style>${styles}</style>
      </head>
      <body>
        <button onclick="window.close()" class="close-btn">FECHAR IMPRESSÃO</button>
        
        <h1>MEU PUDINZINHO</h1>
        <h2>DOCUMENTO NÃO FISCAL</h2>
        
        <div class="text-center">Pedido #${order.id.slice(0,6).toUpperCase()}</div>
        <div class="text-center">${new Date(order.created_at).toLocaleString('pt-BR')}</div>
        
        ${addressHtml}
        
        <div class="divider-thick"></div>
        <div class="bold" style="margin-bottom: 5px;">ITENS DO PEDIDO</div>
        ${itemsHtml}
        
        <div class="divider-thick"></div>
        
        <div class="row">
            <span>Pagamento:</span>
            <span>${order.payment_method || 'Dinheiro'}</span>
        </div>
        
        <div class="divider"></div>
        
        <div class="row">
            <span>Total do Pedido:</span>
            <span>${formatBRL(total)}</span>
        </div>
        <div class="row">
            <span>Valor Recebido:</span>
            <span>${formatBRL(paid)}</span>
        </div>
        
        ${pending > 0 ? `
        <div class="row bold" style="margin-top: 5px; font-size: 15px;">
            <span>PENDENTE:</span>
            <span>${formatBRL(pending)}</span>
        </div>
        ` : `
        <div class="row bold" style="margin-top: 5px;">
            <span>STATUS:</span>
            <span>PAGO TOTAL</span>
        </div>
        `}
        
        <div class="divider-thick"></div>
        <div class="text-center" style="font-size: 10px; margin-top: 10px;">Obrigado pela preferência!</div>
        
        <script>
            window.onload = function() { 
                setTimeout(function() { window.print(); }, 500); 
            };
        </script>
      </body>
      </html>
    `;
};