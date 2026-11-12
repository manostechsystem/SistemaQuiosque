const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { DATA_DIR } = require('./pasta-dados.js');

const DATA_FILE = path.join(DATA_DIR, 'pdv.json');

const PADRAO = {
  categorias: [
    { id: 'cat-bebidas', nome: 'Bebidas', ordem: 1 },
    { id: 'cat-comida', nome: 'Comida', ordem: 2 },
    { id: 'cat-acai', nome: 'Açaí', ordem: 3 },
    { id: 'cat-alugueis', nome: 'Aluguéis', ordem: 4 },
    { id: 'cat-servicos', nome: 'Serviços', ordem: 5 }
  ],
  produtos: [],
  vendas: [],
  ajustes: [],
  funcionarios: [],
  caixas: [],
  config: {
    loja: '',
    cnpj: '',
    endereco: '',
    telefone: '',
    larguraCupom: 80,
    impressoraSilenciosa: false,
    ultimoCupom: 0,
    impressoraCaixa: '',
    impressoraCozinha: '',
    cozinhaAtiva: true,
    larguraCozinha: 80,
    comandaVias: 1
  }
};

function lerDados() {
  try {
    if (!fs.existsSync(DATA_FILE)) return structuredClone(PADRAO);
    const brutos = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    return { ...structuredClone(PADRAO), ...brutos, config: { ...PADRAO.config, ...brutos.config } };
  } catch (err) {
    console.error('Falha ao ler dados:', err);
    const backup = DATA_FILE + '.corrompido-' + Date.now();
    try { if (fs.existsSync(DATA_FILE)) fs.copyFileSync(DATA_FILE, backup); } catch {}
    return structuredClone(PADRAO);
  }
}

function salvarDados(dados) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(dados));
  fs.renameSync(tmp, DATA_FILE);
  return true;
}

function criarJanela() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    autoHideMenuBar: true,
    backgroundColor: '#F8F2E7',
    icon: path.join(__dirname, 'src', 'assets', 'icon.ico'),
    title: 'ManosTech PDV — Sistema Quiosque',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
}

app.whenReady().then(() => {
  // Inicia o servidor HTTP local para pareamento do celular e retaguarda
  try {
    require('./server.js');
    console.log('[MAIN] Servidor HTTP local inicializado com sucesso.');
  } catch (err) {
    console.warn('[MAIN] Aviso ao iniciar server.js:', err.message);
  }
  criarJanela();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) criarJanela(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

ipcMain.handle('db:ler', () => lerDados());

ipcMain.handle('db:salvar', (_e, dados) => {
  try { return salvarDados(dados); } catch (err) { console.error(err); return false; }
});

ipcMain.handle('cupom:imprimir', async (_e, { html, larguraMm, silencioso, impressora }) => {
  const larguraFinal = Number(larguraMm) || 80;
  const janela = new BrowserWindow({
    show: false,
    width: Math.round(larguraFinal * 3.78) + 40,
    height: 600,
    webPreferences: { contextIsolation: true }
  });
  try {
    await janela.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    const opcoes = {
      silent: !!silencioso,
      printBackground: true,
      margins: { marginType: 'none' }
    };
    if (impressora && typeof impressora === 'string' && impressora.trim() && impressora !== 'padrao' && impressora !== 'mesma') {
      opcoes.deviceName = impressora.trim();
    }
    const ok = await new Promise(resolve => {
      janela.webContents.print(
        opcoes,
        (sucesso, failureReason) => {
          if (!sucesso && failureReason) {
            console.warn('Falha na impressão:', failureReason);
          }
          resolve(!!sucesso);
        }
      );
    });
    if (!ok) console.warn('Impressão não concluída (impressora indisponível?)');
    return ok;
  } catch (err) {
    console.error('Falha ao imprimir:', err);
    return false;
  } finally {
    setTimeout(() => { if (!janela.isDestroyed()) janela.destroy(); }, 1000);
  }
});

ipcMain.handle('sistema:listar-impressoras', async (event) => {
  try {
    const win = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getAllWindows()[0];
    if (win && win.webContents && typeof win.webContents.getPrintersAsync === 'function') {
      const lista = await win.webContents.getPrintersAsync();
      return (lista || []).map(p => ({
        name: p.name,
        displayName: p.displayName || p.name,
        isDefault: !!p.isDefault,
        status: p.status
      }));
    }
    return [];
  } catch (err) {
    console.error('Erro ao listar impressoras:', err);
    return [];
  }
});

ipcMain.handle('cupom:escolher-pasta', async () => {
  const r = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
  return r.canceled ? null : r.filePaths[0];
});

ipcMain.handle('dados:exportar', async () => {
  const r = await dialog.showSaveDialog({
    defaultPath: `backup-manostech-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (r.canceled) return false;
  try {
    if (fs.existsSync(DATA_FILE)) fs.copyFileSync(DATA_FILE, r.filePath);
    else fs.writeFileSync(r.filePath, JSON.stringify(lerDados()));
    return true;
  } catch (err) {
    console.error('Falha no backup:', err);
    return false;
  }
});

/* ============ Seleção de XML de NF-e para Importação ============ */
ipcMain.handle('nfe:selecionar-xml', async () => {
  const r = await dialog.showOpenDialog({
    title: 'Selecionar XML de Nota Fiscal de Compra (NF-e)',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Arquivos XML de Nota Fiscal', extensions: ['xml'] }]
  });
  if (r.canceled || !r.filePaths.length) return null;
  return r.filePaths.map(filePath => {
    try {
      const conteudo = fs.readFileSync(filePath, 'utf8');
      return { caminho: filePath, nome: path.basename(filePath), conteudo };
    } catch (err) {
      console.error('Erro ao ler XML:', filePath, err);
      return null;
    }
  }).filter(Boolean);
});

/* ============ Exportação de XMLs para Contabilidade ============ */
ipcMain.handle('contabilidade:salvar-pacote', async (_e, { nomeArquivo, conteudoZipOuXml, tipo }) => {
  const r = await dialog.showSaveDialog({
    title: 'Salvar Arquivo para Contabilidade',
    defaultPath: nomeArquivo || `vendas-contabilidade-${new Date().toISOString().slice(0, 10)}.xml`,
    filters: tipo === 'zip'
      ? [{ name: 'Arquivo ZIP', extensions: ['zip'] }]
      : [{ name: 'Arquivo XML', extensions: ['xml'] }]
  });
  if (r.canceled || !r.filePath) return false;
  try {
    if (tipo === 'zip' && Buffer.isBuffer(conteudoZipOuXml)) {
      fs.writeFileSync(r.filePath, conteudoZipOuXml);
    } else {
      fs.writeFileSync(r.filePath, conteudoZipOuXml, 'utf8');
    }
    return true;
  } catch (err) {
    console.error('Falha ao salvar arquivo contábil:', err);
    return false;
  }
});

/* ============ Autenticação de funcionários ============ */
function hashSenha(senha) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(senha), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function conferirSenha(senha, guardado) {
  const [salt, hash] = String(guardado || '').split(':');
  if (!salt || !hash) return false;
  const tentativa = crypto.scryptSync(String(senha), salt, 64);
  const alvo = Buffer.from(hash, 'hex');
  return tentativa.length === alvo.length && crypto.timingSafeEqual(tentativa, alvo);
}

ipcMain.handle('auth:hash', (_e, senha) => {
  if (!senha || String(senha).length < 3) return null;
  return hashSenha(senha);
});

ipcMain.handle('auth:conferir', (_e, { senha, guardado }) => {
  try { return conferirSenha(senha, guardado); } catch { return false; }
});
