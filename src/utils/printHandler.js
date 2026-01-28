export const executePrint = (htmlContent) => {
  // Abre a janela
  const win = window.open('', '_blank', 'width=350,height=600');

  if (win) {
    // Escreve o conteúdo
    win.document.write(htmlContent);
    win.document.close(); // Fecha o fluxo de escrita para o navegador renderizar
    
    // O foco ajuda a janela a vir para frente antes de imprimir
    win.focus();
  } else {
    alert('Por favor, permita popups para imprimir.');
  }
};