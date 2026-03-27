import { formatBRL } from '../formatters';

export const commissionPrint = ({ 
    sellerName, 
    monthName, 
    totalSales, 
    totalReceivedCash, 
    commissionRate, 
    commissionOnReceived, 
    totalConsumed, 
    extraDiscountsList, 
    finalPayout 
}) => {
    
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
      h2 { font-size: 18px; text-align: center; margin: 5px 0; font-weight: 900; }
      .text-center { text-align: center; }
      .divider { border-top: 1px dashed #000; margin: 8px 0; }
      .divider-thick { border-top: 2px solid #000; margin: 10px 0; }
      .row { display: flex; justify-content: space-between; margin-bottom: 4px; }
      .bold { font-weight: 900; }
      .total { font-size: 20px; font-weight: 900; text-align: right; margin-top: 10px; }
      .close-btn { width: 100%; padding: 10px; background: #000; color: #fff; text-align: center; margin-bottom: 10px; cursor: pointer; border: none; font-weight: bold; }
      @media print { .close-btn { display: none; } }
    `;

    const discountsHtml = extraDiscountsList.map(desc => `
      <div class="row" style="font-size: 11px;">
          <span>(-) ${desc.reason || 'Desconto Extra'}:</span>
          <span>${formatBRL(desc.amount)}</span>
      </div>
    `).join('');

    return `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <style>${styles}</style>
      </head>
      <body>
        <button onclick="window.close()" class="close-btn">FECHAR IMPRESSÃO</button>
        
        <h2>ACERTO DE CONTAS</h2>
        <div class="text-center" style="font-size: 14px;">${sellerName}</div>
        <div class="text-center" style="font-size: 12px; margin-bottom: 10px;">${monthName}</div>
        
        <div class="divider-thick"></div>
        
        <div class="row">
            <span>Total de Vendas:</span>
            <span>${formatBRL(totalSales)}</span>
        </div>
        <div class="row">
            <span>Vendas Dinheiro/Pix:</span>
            <span>${formatBRL(totalReceivedCash)}</span>
        </div>
        <div class="row">
            <span>Taxa Aplicada:</span>
            <span>${commissionRate}%</span>
        </div>
        
        <div class="divider"></div>
        
        <div class="row bold" style="font-size: 14px;">
            <span>Comissão Bruta:</span>
            <span>${formatBRL(commissionOnReceived)}</span>
        </div>
        
        <div class="divider"></div>
        
        <div class="row">
            <span>(-) Consumo:</span>
            <span>${formatBRL(totalConsumed)}</span>
        </div>
        
        ${discountsHtml}
        
        <div class="divider-thick"></div>
        <div class="total">A PAGAR: ${formatBRL(finalPayout)}</div>
        
        <div style="text-align: center; font-size: 10px; margin-top: 20px;">Gerado em ${new Date().toLocaleString('pt-BR')}</div>
        <div style="text-align: center; font-size: 10px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #000;">Assinatura do Colaborador</div>
        
        <script>
            window.onload = function() { 
                setTimeout(function() { window.print(); }, 500); 
            };
        </script>
      </body>
      </html>
    `;
};