// Testa vista Produtos: cadastro completo de produto novo
document.querySelector('.trilho__btn[data-vista="produtos"]').click();
await new Promise(r => setTimeout(r, 100));
const linhasAntes = document.querySelectorAll('#prod-tabela tbody tr').length;
document.getElementById('btn-novo-produto').click();
await new Promise(r => setTimeout(r, 100));
document.querySelector('#f-nome').value = 'Teste QA Bebida';
document.querySelector('#f-nome').dispatchEvent(new Event('input', { bubbles: true }));
document.querySelector('#f-preco').value = '7,50';
document.querySelector('#f-estoque').value = '9';
document.querySelector('#f-salvar').click();
await new Promise(r => setTimeout(r, 300));
const linhasDepois = document.querySelectorAll('#prod-tabela tbody tr').length;
return JSON.stringify({
  vista: document.querySelector('.vista.ativa')?.id || document.querySelector('.ativa')?.id,
  linhasAntes, linhasDepois,
  modalFechado: document.getElementById('modal').hidden,
  toast: document.getElementById('toast')?.textContent || '',
  gradeTemNovo: [...document.querySelectorAll('#grade .prod')].some(b => b.textContent.includes('Teste QA'))
});
