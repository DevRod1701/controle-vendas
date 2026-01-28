import { formatBRL } from '../formatters';

export const orderReportTemplate = (order) => {
  const date = new Date(order.created_at).toLocaleString('pt-BR');
  
  const total = Number(order.total);
  const paid = Number(order.paid || 0);
  const remaining = total - paid;

  // CSS PADRONIZADO (80mm, Flexbox)
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
    }
    h2 { font-size: 18px; text-align: center; margin: 5px 0; font-weight: 900; }
    .divider { border-top: 1px dashed #000; margin: 10px 0; }
    .text-center { text-align: center; }
    
    /* AQUI ESTÁ O SEGREDO DO ALINHAMENTO: Space Between */
    .row { display: flex; justify-content: space-between; margin: 2px 0; }
    
    .section-title { 
        margin-top: 15px; 
        margin-bottom: 5px; 
        font-weight: 900; 
        border-bottom: 1px solid #000; 
        display: inline-block;
        width: 100%;
    }

    .close-btn { width: 100%; padding: 10px; background: #000; color: #fff; text-align: center; margin-top: 10px; cursor: pointer; border: none; }
    @media print { .close-btn { display: none; } }
  `;

  // Gera lista de itens
  const itemsHtml = order.order_items.map(item => `
    <div class="row">
        <span>${item.qty}x ${item.name}</span>
        <span>${formatBRL(item.price * item.qty)}</span>
    </div>
    ${item.qty === 0 ? `<div style="text-align:center; font-size:11px; text-decoration:line-through;">(Item Devolvido)</div>` : ''}
  `).join('');

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <title>Pedido #${order.id.slice(0, 5)}</title>
        <style>${styles}</style>
      </head>
      <body>
        <button onclick="window.close()" class="close-btn">FECHAR</button>

        <h2>MEU PUDINZINHO</h2>
        <div class="text-center" style="font-size: 11px; margin-bottom: 5px;">Controle Interno</div>

        <div class="divider"></div>

        <div class="row">
            <span>Pedido:</span>
            <span>#${order.id.slice(0, 5)}</span>
        </div>
        <div class="row">
            <span>Data:</span>
            <span>${date}</span>
        </div>
        <div class="row">
            <span>Vendedor:</span>
            <span>${order.seller_name}</span>
        </div>

        <div class="divider"></div>

        <div class="section-title">ITENS</div>
        ${itemsHtml}

        <div class="divider"></div>

        <div class="row" style="font-size: 14px; font-weight: 900;">
            <span>TOTAL:</span>
            <span>${formatBRL(total)}</span>
        </div>
        
        <div class="row">
            <span>Pago:</span>
            <span>${formatBRL(paid)}</span>
        </div>

        <div class="row">
            <span>${remaining > 0.01 ? 'Falta:' : 'Status:'}</span>
            <span>${remaining > 0.01 ? formatBRL(remaining) : 'QUITADO'}</span>
        </div>

        <div class="divider"></div>
        <div class="text-center" style="font-size: 10px;">*** SEM VALOR FISCAL ***</div>

        <script>
          setTimeout(function() { window.print(); }, 500);
        </script>
      </body>
    </html>
  `;
};