import { formatBRL } from './formatters';

export const printOrder = (order) => {
  const date = new Date(order.created_at).toLocaleString('pt-BR');

  const itemsHtml = `
    <table>
      ${order.order_items.map(item => `
        <tr>
          <td class="qty">${item.qty}x</td>
          <td class="name">${item.name}</td>
          <td class="price">${formatBRL(item.price * item.qty)}</td>
        </tr>
        ${item.qty === 0 ? `
          <tr>
            <td colspan="3" class="returned">(Item Devolvido)</td>
          </tr>
        ` : ''}
      `).join('')}
    </table>
  `;

  const content = `
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <title>Pedido #${order.id.slice(0, 5)}</title>

        <style>
          /* ===== CONFIGURAÇÃO IMPRESSORA TÉRMICA 80MM ===== */
          @page {
            size: 80mm auto;
            margin: 0;
          }

          body {
            width: 80mm;
            margin: 0;
            padding: 4mm;
            font-family: Courier, monospace;
            font-size: 12px;
            line-height: 1.2;
            color: #000;
            background: #fff;
          }

          h2 {
            text-align: center;
            font-size: 16px;
            margin: 4px 0;
            font-weight: bold;
          }

          p {
            margin: 2px 0;
          }

          .center {
            text-align: center;
          }

          .divider {
            border-top: 2px dashed #000;
            margin: 6px 0;
          }

          .info p {
            text-align: left;
            font-size: 11px;
          }

          table {
            width: 100%;
            border-collapse: collapse;
          }

          td {
            padding: 2px 0;
            vertical-align: top;
          }

          td.qty {
            width: 10%;
          }

          td.name {
            width: 60%;
            word-break: break-word;
          }

          td.price {
            width: 30%;
            text-align: right;
            white-space: nowrap;
          }

          .returned {
            font-size: 10px;
            text-decoration: line-through;
          }

          .total {
            font-size: 14px;
            font-weight: bold;
            text-align: right;
          }

          .payment {
            text-align: right;
            font-size: 12px;
          }

          .footer {
            margin-top: 10px;
            font-size: 10px;
            text-align: center;
            font-weight: bold;
          }

          /* ===== TELA ===== */
          .no-print {
            display: block;
          }

          .close-btn {
            width: 100%;
            padding: 12px;
            margin-bottom: 10px;
            background: #ef4444;
            color: #fff;
            border: none;
            border-radius: 6px;
            font-weight: bold;
            cursor: pointer;
            font-family: sans-serif;
          }

          /* ===== IMPRESSÃO ===== */
          @media print {
            .no-print {
              display: none !important;
            }
          }
        </style>
      </head>

      <body>
        <!-- BOTÃO SOMENTE NA TELA -->
        <button onclick="window.close()" class="no-print close-btn">
          FECHAR JANELA
        </button>

        <h2>MEU PUDINZINHO</h2>
        <p class="center" style="font-size:11px;">Controle Interno</p>

        <div class="divider"></div>

        <div class="info">
          <p><strong>Vend:</strong> ${order.seller_name}</p>
          <p><strong>Data:</strong> ${date}</p>
          <p><strong>Ped:</strong> #${order.id.slice(0, 5)}</p>
        </div>

        <div class="divider"></div>

        ${itemsHtml}

        <div class="divider"></div>

        <div class="total">
          TOTAL: ${formatBRL(order.total)}
        </div>

        <div class="payment">
          Pago: ${formatBRL(order.paid || 0)}<br/>
          ${
            order.total - (order.paid || 0) > 0.01
              ? `Falta: ${formatBRL(order.total - (order.paid || 0))}`
              : 'STATUS: QUITADO'
          }
        </div>

        <div class="footer">
          *** SEM VALOR FISCAL ***
        </div>

        <script>
          window.onload = function () {
            setTimeout(function () {
              window.print();
            }, 300);
          };
        </script>
      </body>
    </html>
  `;

  const win = window.open('', '_blank');

  if (win) {
    win.document.write(content);
    win.document.close();
  } else {
    alert('Por favor, permita popups para imprimir.');
  }
};
