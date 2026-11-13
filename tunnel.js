const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { DATA_DIR } = require('./pasta-dados.js');

let tunnelProcess = null;
let currentTunnelUrl = '';
let tunnelStatus = 'offline'; // 'offline' | 'conectando' | 'online' | 'baixando'
let listeners = [];
let autoRestartTimeout = null;
let portaServidor = 3000;

function encontrarExecutavel() {
  const caminhos = [
    // 1. Recursos empacotados pelo Electron (extraResources)
    process.resourcesPath ? path.join(process.resourcesPath, 'tools', 'cloudflared.exe') : null,
    // 2. Pasta local do projeto (modo dev)
    path.join(__dirname, 'tools', 'cloudflared.exe'),
    // 3. Pasta de dados do usuário (se baixado automaticamente)
    path.join(DATA_DIR, 'tools', 'cloudflared.exe'),
    // 4. No diretório do executável (portable/unpacked)
    process.execPath ? path.join(path.dirname(process.execPath), 'tools', 'cloudflared.exe') : null
  ].filter(Boolean);

  for (const c of caminhos) {
    try {
      if (fs.existsSync(c)) {
        return c;
      }
    } catch {}
  }
  return null;
}

async function baixarExecutavelSeNecessario() {
  const destinoDir = path.join(DATA_DIR, 'tools');
  const destino = path.join(destinoDir, 'cloudflared.exe');

  if (fs.existsSync(destino)) return destino;

  fs.mkdirSync(destinoDir, { recursive: true });
  tunnelStatus = 'baixando';
  console.log('[TUNNEL] Baixando conector de nuvem oficial em segundo plano...');

  const urlDownload = 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe';

  return new Promise((resolve, reject) => {
    function tentarDownload(urlAtual, redirecionamentos = 0) {
      if (redirecionamentos > 5) {
        return reject(new Error('Muitos redirecionamentos'));
      }

      https.get(urlAtual, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return tentarDownload(res.headers.location, redirecionamentos + 1);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`Falha no download: HTTP ${res.statusCode}`));
        }

        const stream = fs.createWriteStream(destino);
        res.pipe(stream);
        stream.on('finish', () => {
          stream.close();
          console.log('[TUNNEL] Download do conector concluído com sucesso!');
          resolve(destino);
        });
        stream.on('error', (err) => {
          try { fs.unlinkSync(destino); } catch {}
          reject(err);
        });
      }).on('error', (err) => {
        try { fs.unlinkSync(destino); } catch {}
        reject(err);
      });
    }

    tentarDownload(urlDownload);
  });
}

function registrarListener(fn) {
  if (typeof fn === 'function') listeners.push(fn);
}

function notificar(url) {
  for (const fn of listeners) {
    try { fn(url); } catch (e) { console.error('[TUNNEL] Erro no listener:', e); }
  }
}

async function iniciar(porta = 3000) {
  portaServidor = porta;
  if (tunnelProcess) return;

  tunnelStatus = 'conectando';
  let bin = encontrarExecutavel();

  if (!bin) {
    try {
      bin = await baixarExecutavelSeNecessario();
    } catch (err) {
      console.warn('[TUNNEL] Não foi possível obter o executável:', err.message);
      tunnelStatus = 'offline';
      return;
    }
  }

  console.log(`[TUNNEL] Iniciando conector automático para http://localhost:${porta}... (${bin})`);

  try {
    tunnelProcess = spawn(bin, ['tunnel', '--url', `http://localhost:${porta}`], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const processarSaida = (data) => {
      const texto = data.toString();
      const match = texto.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
      if (match) {
        const urlCapturada = match[0];
        if (urlCapturada !== currentTunnelUrl) {
          currentTunnelUrl = urlCapturada;
          tunnelStatus = 'online';
          console.log('[TUNNEL] Link seguro 4G ativo:', currentTunnelUrl);
          notificar(currentTunnelUrl);
        }
      }
    };

    tunnelProcess.stdout.on('data', processarSaida);
    tunnelProcess.stderr.on('data', processarSaida);

    tunnelProcess.on('close', (codigo) => {
      console.log(`[TUNNEL] Conector finalizado (código ${codigo})`);
      tunnelProcess = null;
      tunnelStatus = 'offline';
      currentTunnelUrl = '';

      // Tenta reiniciar após 6 segundos se fechou inesperadamente
      if (!autoRestartTimeout) {
        autoRestartTimeout = setTimeout(() => {
          autoRestartTimeout = null;
          iniciar(portaServidor);
        }, 6000);
      }
    });

    tunnelProcess.on('error', (err) => {
      console.warn('[TUNNEL] Erro no processo do túnel:', err.message);
      tunnelProcess = null;
      tunnelStatus = 'offline';
    });

  } catch (err) {
    console.error('[TUNNEL] Falha ao disparar processo:', err);
    tunnelStatus = 'offline';
  }
}

function parar() {
  if (autoRestartTimeout) {
    clearTimeout(autoRestartTimeout);
    autoRestartTimeout = null;
  }
  if (tunnelProcess) {
    try {
      tunnelProcess.kill();
    } catch {}
    tunnelProcess = null;
  }
  tunnelStatus = 'offline';
  currentTunnelUrl = '';
}

function obterStatus() {
  return {
    status: tunnelStatus,
    url: currentTunnelUrl,
    urlMobile: currentTunnelUrl ? `${currentTunnelUrl}/mobile.html` : ''
  };
}

process.on('exit', parar);
process.on('SIGINT', parar);
process.on('SIGTERM', parar);

module.exports = {
  iniciar,
  parar,
  obterStatus,
  registrarListener
};
