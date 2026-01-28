export const reportTemplate = ({ periodStr, currentSellerName, stats, orders, payments, reportType }) => {
  
    // Configuração para 80mm e layout idêntico ao exemplo
    const styles = `
      @page { size: 80mm auto; margin: 0; }
      body { 
          font-family: 'Courier New', monospace; 
          width: 80mm; 
          margin: 0; 
          padding: 5px; 
          color: #000; 
          font-size: 13px; /* Aumentei levemente para 80mm */
          line-height: 1.2;
          font-weight: bold; 
      }
      h2 { font-size: 18px; text-align: center; margin: 5px 0; font-weight: 900; }
      .divider { border-top: 1px dashed #000; margin: 10px 0; }
      .text-center { text-align: center; }
      
      /* Linhas de totais e itens */
      .row { display: flex; justify-content: space-between; margin: 2px 0; }
      
      /* Títulos das Seções (PEDIDOS, PAGAMENTOS) */
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
  
    // Gera HTML dos PEDIDOS
    const ordersHtml = orders.map(item => `
      <div class="row">
          <span>${item.date} - ${item.desc}</span>
          <span>${item.value}</span>
      </div>
    `).join('');
  
    // Gera HTML dos PAGAMENTOS
    const paymentsHtml = payments.map(item => `
      <div class="row">
          <span>${item.date} - ${item.desc}</span>
          <span>${item.value}</span>
      </div>
    `).join('');
  
    return `
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="UTF-8" />
          <title>Relatório</title>
          <style>${styles}</style>
        </head>
        <body>
          <button onclick="window.close()" class="close-btn">FECHAR</button>
          
          <h2>RELATÓRIO</h2>
          <div class="text-center">${periodStr}</div>
          <div class="text-center">${currentSellerName}</div>
          
          <div class="divider"></div>
          
          ${reportType !== 'payments' ? `
            <div class="row"><span>Vendas Liq:</span><span>${stats.netSales}</span></div>
            <div class="row"><span>Comissão:</span><span>${stats.commission}</span></div>
          ` : ''}
  
          ${reportType !== 'orders' ? `
            <div class="row"><span>Recebido:</span><span>${stats.totalReceived}</span></div>
          ` : ''}
  
          ${/* SEÇÃO DE PEDIDOS */ ''}
          ${(reportType !== 'payments' && orders.length > 0) ? `
              <div class="section-title">PEDIDOS</div>
              ${ordersHtml}
          ` : ''}
  
          ${/* SEÇÃO DE PAGAMENTOS */ ''}
          ${(reportType !== 'orders' && payments.length > 0) ? `
              <div class="section-title">PAGAMENTOS</div>
              ${paymentsHtml}
          ` : ''}
          
          <div class="divider"></div>
          <div style="text-align: center; font-size: 10px;">Gerado em ${new Date().toLocaleString()}</div>
  
          <script>
              setTimeout(function() { window.print(); }, 500);
          </script>
        </body>
      </html>
    `;
  };