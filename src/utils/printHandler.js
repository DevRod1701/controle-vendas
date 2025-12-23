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
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Pedido #${order.id.slice(0, 5)}</title>
        <style>
          /* Configurações de Impressão */
          @page { 
            size: 58mm auto; 
            margin: 0; 
          }
          
          body { 
            font-family: 'Courier New', Courier, monospace; 
            margin: 0; 
            padding: 5px; 
            color: #000;
            background-color: #fff;
            font-size: 14px; 
            line-height: 1.2;
            width: 100%;
            max-width: 58mm; /* Garante que não estoure no mobile */
          }

          h2 { font-size: 20px; text-align: center; margin: 5px 0; font-weight: 900; }
          p { margin: 2px 0; text-align: center; }
          
          .divider { border-top: 2px dashed #000; margin: 10px 0; }
          .info { font-size: 13px; margin-bottom: 10px; }
          .total-section { font-size: 18px; font-weight: 900; text-align: right; margin-top: 10px; }
          .footer { font-size: 11px; text-align: center; margin-top: 20px; font-weight: bold; }

          /* Oculta o botão de fechar na hora da impressão */
          @media print {
            .no-print { display: none !important; }
          }

          /* Estilo do botão de fechar para Mobile */
          .close-btn {
            display: block;
            width: 100%;
            padding: 15px;
            background-color: #ef4444;
            color: white;
            text-align: center;
            font-weight: bold;
            text-decoration: none;
            font-family: sans-serif;
            margin-top: 20px;
            border-radius: 8px;
            cursor: pointer;
            border: none;
          }
        </style>
      </head>
      <body>
        <!-- Botão de Voltar (Só aparece na tela, não no papel) -->
        <button onclick="window.close()" class="no-print close-btn">FECHAR JANELA</button>

        <div style="padding-top: 10px;">
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
        </div>
        
        <script>
            // Função segura para imprimir
            function safePrint() {
                // Pequeno delay para garantir que o CSS carregou no mobile
                setTimeout(function() {
                    window.print();
                }, 500);
            }

            // Tenta imprimir assim que carregar
            window.onload = safePrint;
        </script>
      </body>
    </html>
  `;

  // Abre uma nova janela/aba
  const win = window.open('', '_blank');
  
  if (win) {
      win.document.write(content);
      win.document.close(); // Importante para o navegador saber que terminou de baixar o HTML
  } else {
      alert("Por favor, permita popups para imprimir.");
  }
};
