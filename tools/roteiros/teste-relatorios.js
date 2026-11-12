// Testa vista Relatórios: deve listar a venda de teste com total do dia
document.querySelector('.trilho__btn[data-vista="relatorios"]').click();
await new Promise(r => setTimeout(r, 200));
const ids = [...document.querySelectorAll('#vista-relatorios [id]')].map(e => e.id);
const txt = document.getElementById('vista-relatorios').innerText.replace(/\s+/g, ' ').slice(0, 400);
return JSON.stringify({ ids, txt });
