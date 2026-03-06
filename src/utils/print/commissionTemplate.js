export const commissionTemplate = ({
  currentSellerName,
  selectedMonthStr,
  totalSales,
  totalReceived,
  commissionRate,
  commissionGross,
  totalConsumed,
  extraDiscountStr,
  finalPayout,
  saldoAntStr,
  amountPaid,
  remainingLabel,
  remainingStr
}) => {
  const styles = `
    @page { size: 58mm auto; margin: 0; }
    body { 
        font-family: 'Courier New', Courier, monospace; 
        width: 58mm; 
        margin: 0; 
        padding: 5px; 
        color: #000; 
        font-size: 12px;
        font-weight: 900; /* Força o preto na impressora térmica */
        -webkit-font-smoothing: none;
    }
    h2 { font-size: 16px; text-align: center; margin: 5px 0; font-weight: 900; }
    .divider { border-top: 2px dashed #000; margin: 8px 0; }
    .row { display: flex; justify-content: space-between; margin-bottom: 4px; font-weight: 900; }
    .bold { font-weight: 900; }
    .total { font-size: 14px; font-weight: 900; text-align: right; margin-top: 10px; }
    .signature { margin-top: 40px; border-top: 1px solid #000; text-align: center; font-size: 10px; padding-top: 5px; font-weight: bold; }
    .close-btn { width: 100%; padding: 10px; background: #000; color: #fff; text-align: center; margin-top: 10px; cursor: pointer; border: none; font-weight: bold; }
    @media print { .close-btn { display: none; } }
  `;

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <style>${styles}</style>
    </head>
    <body>
      <button onclick="window.close()" class="close-btn">FECHAR</button>
      
      <h2>COMISSÃO</h2>
      <div style="text-align: center; font-size: 12px; margin-bottom: 5px; font-weight: bold;">${currentSellerName}</div>
      <div style="text-align: center; font-size: 12px; margin-bottom: 10px; font-weight: bold;">MÊS: ${selectedMonthStr}</div>
      
      <div class="divider"></div>
      
      <div class="row"><span>Vendas Total:</span><span>${totalSales}</span></div>
      <div class="row"><span>Vendas Din/Pix:</span><span>${totalReceived}</span></div>
      <div class="row"><span>Taxa Aplicada:</span><span>${commissionRate}%</span></div>
      <div class="row bold"><span>Comissão Bruta:</span><span>${commissionGross}</span></div>
      <div class="row"><span>(-) Consumo:</span><span>${totalConsumed}</span></div>
      ${extraDiscountStr}
      
      <div class="divider"></div>
      
      <div class="row bold"><span>Líquido do Mês:</span><span>${finalPayout}</span></div>
      ${saldoAntStr}
      
      <div class="divider"></div>
      
      <div class="row bold"><span>Já Pago:</span><span>${amountPaid}</span></div>
      <div class="total">${remainingLabel}: ${remainingStr}</div>
      
      <div class="signature">Assinatura do Recebedor</div>
      <div style="text-align: center; font-size: 10px; margin-top: 10px; font-weight: bold;">Gerado em ${new Date().toLocaleString('pt-BR')}</div>
      
      <script>
          window.onload = function() { 
              setTimeout(function() { window.print(); }, 500); 
          };
      </script>
    </body>
    </html>
  `;
};