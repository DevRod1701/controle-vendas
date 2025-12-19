// src/utils/formatters.js
export const formatBRL = (value) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(Number(value) || 0);
};