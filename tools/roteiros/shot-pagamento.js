// Captura: modal de pagamento com troco calculado
const btns = document.querySelectorAll('#grade .prod');
btns[0].click(); btns[0].click(); btns[6].click(); btns[11].click();
document.getElementById('btn-pagar').click();
for (const k of ['1', '0', '0', '0']) {
  document.querySelector(`#pg-teclado [data-k="${k}"]`).click();
}
await new Promise(r => setTimeout(r, 150));
