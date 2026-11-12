/* Utilitário de desenvolvimento: abre o PDV de verdade, executa um roteiro
   opcional e salva a tela em PNG.
   Uso: npx electron tools/shot.js <saida.png> [vista] [arquivo-roteiro.js] */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const saida = process.argv[2] || path.join(__dirname, 'tela.png');
const vista = process.argv[3] || '';
const roteiro = process.argv[4] && fs.existsSync(process.argv[4]) ? fs.readFileSync(process.argv[4], 'utf8') : '';

require('../main.js');

app.on('browser-window-created', (_e, win) => {
  win.hide();
  win.webContents.on('did-finish-load', async () => {
    try {
      await new Promise(r => setTimeout(r, 700));
      if (roteiro) await win.webContents.executeJavaScript(`(async () => { ${roteiro} })(); null`);
      if (vista) await win.webContents.executeJavaScript(`App.irPara(${JSON.stringify(vista)}); null`);
      await new Promise(r => setTimeout(r, 500));
      const img = await win.webContents.capturePage();
      fs.writeFileSync(saida, img.toPNG());
      console.log('ok', saida);
    } catch (err) {
      console.error('erro na captura:', err);
    }
    app.quit();
  });
});
