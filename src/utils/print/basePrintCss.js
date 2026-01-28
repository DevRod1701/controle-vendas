export const basePrintCss = `
@page {
  size: 80mm auto;
  margin: 0;
}

body {
  width: 80mm;
  margin: 0;
  padding: 5px;
  font-family: 'Courier New', Courier, monospace;
  font-size: 14px;
  line-height: 1.25;
  color: #000;
  background: #fff;

  /* força térmica */
  font-weight: 700;
  letter-spacing: -0.2px;
}

h2 {
  font-size: 20px;
  text-align: center;
  margin: 5px 0;
  font-weight: 900;
  letter-spacing: -0.3px;
  text-shadow: 0.3px 0 0 #000;
}

p {
  margin: 2px 0;
  text-shadow: 0.25px 0 0 #000;
}

.divider {
  border-top: 1px dashed #000; /* MAIS LEVE */
  margin: 12px 0;
}

.info {
  text-align: center;
  font-size: 13px;
}

.row {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  margin: 4px 0;
  text-shadow: 0.25px 0 0 #000;
}

.total-row {
  display: flex;
  justify-content: space-between;
  font-weight: bold;
  margin: 3px 0;
}

.big-total {
  font-size: 18px;
  font-weight: 900;
  text-align: right;
  margin-top: 6px;
  text-shadow: 0.4px 0 0 #000;
}

.section-title {
  font-weight: 900;
  margin-top: 10px;
  border-bottom: 1px dashed #000;
}

.footer {
  margin-top: 15px;
  font-size: 11px;
  text-align: center;
  font-weight: bold;
}

.close-btn {
  width: 100%;
  padding: 14px;
  margin-bottom: 10px;
  background: #000;
  color: #fff;
  border: none;
  font-weight: bold;
  font-family: sans-serif;
}

@media print {
  .close-btn {
    display: none !important;
  }
}
`;
