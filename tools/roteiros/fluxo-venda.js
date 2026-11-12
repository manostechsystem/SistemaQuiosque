// Fluxo completo: adiciona itens, paga em dinheiro com troco, confere cupom gerado
const btns = document.querySelectorAll('#grade .prod');
btns[0].click(); btns[0].click(); btns[6].click();
const totalAntes = document.getElementById('tot-total').textContent;
document.getElementById('btn-pagar').click();
// teclas do teclado numérico: 1 0 0 0 0 (R$ 100,00)
const tec = () => document.querySelector('#pg-teclado');
for (const k of ['1', '0', '0', '0', '0']) {
  tec().querySelector(`[data-k="${k}"]`).click();
}
const recebidoTxt = document.getElementById('pg-recebido').textContent;
const trocoTxt = document.querySelector('#pg-troco b').textContent;
const trocoClasse = document.getElementById('pg-troco').className;
document.getElementById('pg-finalizar').click();
await new Promise(r => setTimeout(r, 600));
return JSON.stringify({
  totalAntes, recebidoTxt, trocoTxt, trocoClasse,
  cupomApos: document.getElementById('cupom-num')?.textContent,
  itensApos: document.querySelectorAll('#itens .item').length,
  totalApos: document.getElementById('tot-total').textContent,
  toast: document.getElementById('toast')?.textContent || '',
  modalFechado: document.getElementById('modal').hidden
});
