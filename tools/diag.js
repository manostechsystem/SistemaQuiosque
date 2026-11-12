/* Diagnóstico: carrega o app e devolve estado do DOM como JSON.
   Uso: npx electron tools/diag.js <arquivo-roteiro.js> */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const roteiro = process.argv[2] && fs.existsSync(process.argv[2]) ? fs.readFileSync(process.argv[2], 'utf8') : '';

require('../main.js');

app.on('browser-window-created', (_e, win) => {
  win.hide();
  win.webContents.on('did-finish-load', async () => {
    try {
      await new Promise(r => setTimeout(r, 900));
      const antes = await win.webContents.executeJavaScript(`JSON.stringify({
        grade: document.querySelectorAll('#grade .prod').length,
        cats: document.querySelectorAll('#cats .cat').length,
        visivel: document.querySelector('.vista.ativa')?.id,
        erroCarregamento: window.__erroApp || null
      })`);
      let depois = antes;
      if (roteiro) {
        depois = await win.webContents.executeJavaScript(`(async () => { try { const __r = await (async () => { ${roteiro}
          })();
          return typeof __r === 'string' ? __r : JSON.stringify(__r ?? 'sem retorno');
          } catch (e) { return 'ERRO: ' + String(e); } })()`);
      }
      console.log('DIAG ' + antes + ' || ' + depois);
    } catch (err) {
      console.error('DIAG erro', err);
    }
    app.quit();
  });
});
