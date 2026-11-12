/**
 * Gerenciador de Aparelhos Conectados (Estilo WhatsApp Web)
 * ManosTech System — Gerenciador de Aparelhos Conectados
 *
 * Funcionalidades:
 * - Gera tokens únicos para QR Code de conexão
 * - Registra modelo, navegador, IP e data/hora do celular conectado
 * - Permite ao administrador no computador listar e desconectar qualquer aparelho
 * - Valida sessões ativas instantaneamente
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DATA_DIR } = require('./pasta-dados.js');

const DISPOSITIVOS_FILE = path.join(DATA_DIR, 'dispositivos.json');

try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch (e) {}

// Chaves temporárias de pareamento QR Code ativas (válidas por 15 minutos)
const tokensPareamento = new Map();

function carregarDispositivos() {
  try {
    if (fs.existsSync(DISPOSITIVOS_FILE)) {
      return JSON.parse(fs.readFileSync(DISPOSITIVOS_FILE, 'utf8'));
    }
  } catch (err) {
    console.warn('[DISPOSITIVOS] Erro ao ler dispositivos.json:', err.message);
  }
  return [];
}

function salvarDispositivos(lista) {
  try {
    fs.writeFileSync(DISPOSITIVOS_FILE, JSON.stringify(lista, null, 2), 'utf8');
  } catch (err) {
    console.error('[DISPOSITIVOS] Erro ao salvar dispositivos.json:', err.message);
  }
}

/**
 * Gera um token temporário único para exibição no QR Code
 */
function gerarTokenPareamento() {
  limparTokensExpirados();
  const token = 'pair_' + crypto.randomBytes(16).toString('hex');
  tokensPareamento.set(token, {
    criadoEm: Date.now(),
    expiraEm: Date.now() + 15 * 60 * 1000 // 15 minutos
  });
  return token;
}

function limparTokensExpirados() {
  const agora = Date.now();
  for (const [token, info] of tokensPareamento.entries()) {
    if (agora > info.expiraEm) {
      tokensPareamento.delete(token);
    }
  }
}

/**
 * Identifica o modelo e sistema operacional simplificado a partir do User-Agent
 */
function parseUserAgent(ua = '') {
  let sistema = 'Dispositivo Móvel';
  let navegador = 'Navegador';

  if (/iPhone/i.test(ua)) sistema = 'iPhone';
  else if (/iPad/i.test(ua)) sistema = 'iPad';
  else if (/Android/i.test(ua)) {
    const match = ua.match(/Android\s+([0-9.]+)/i);
    const versao = match ? ` (${match[1]})` : '';
    sistema = 'Android' + versao;
  } else if (/Windows/i.test(ua)) sistema = 'Windows PC';
  else if (/Macintosh|Mac OS/i.test(ua)) sistema = 'Mac';
  else if (/Linux/i.test(ua)) sistema = 'Linux';

  if (/Edg/i.test(ua)) navegador = 'Edge';
  else if (/Chrome/i.test(ua)) navegador = 'Chrome';
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) navegador = 'Safari';
  else if (/Firefox/i.test(ua)) navegador = 'Firefox';

  return `${sistema} · ${navegador}`;
}

/**
 * Registra o celular quando ele lê o QR Code
 */
function registrarDispositivo({ tokenPareamento, userAgent, ip = '127.0.0.1', nomePersonalizado = '' }) {
  limparTokensExpirados();

  // Verifica se o token de pareamento é válido
  if (!tokensPareamento.has(tokenPareamento)) {
    throw new Error('QR Code expirado ou inválido. Por favor, gere um novo no computador.');
  }

  // Remove o token de pareamento para uso único
  tokensPareamento.delete(tokenPareamento);

  const lista = carregarDispositivos();
  const sessionToken = 'sess_' + crypto.randomBytes(24).toString('hex');
  const nomeModelo = nomePersonalizado || parseUserAgent(userAgent);
  const agora = new Date().toISOString();

  const novoDispositivo = {
    id: 'disp_' + crypto.randomBytes(8).toString('hex'),
    sessionToken,
    nome: nomeModelo,
    usuario: 'Administrador',
    papel: 'admin',
    ip,
    userAgent: userAgent ? userAgent.slice(0, 150) : '',
    conectadoEm: agora,
    ultimoAcesso: agora,
    ativo: true
  };

  lista.unshift(novoDispositivo);
  salvarDispositivos(lista);

  console.log(`[DISPOSITIVOS] Novo celular conectado: ${nomeModelo} (IP: ${ip})`);

  return {
    ok: true,
    sessionToken,
    dispositivo: {
      id: novoDispositivo.id,
      nome: novoDispositivo.nome,
      usuario: novoDispositivo.usuario,
      papel: novoDispositivo.papel,
      conectadoEm: novoDispositivo.conectadoEm
    }
  };
}

/**
 * Lista todos os aparelhos conectados (ativos ou histórico)
 */
function listarDispositivos() {
  const lista = carregarDispositivos();
  return lista.map(d => ({
    id: d.id,
    nome: d.nome,
    usuario: d.usuario,
    papel: d.papel,
    ip: d.ip,
    conectadoEm: d.conectadoEm,
    ultimoAcesso: d.ultimoAcesso,
    ativo: d.ativo
  }));
}

/**
 * Desconecta/revoga a sessão de um aparelho pelo computador
 */
function desconectarDispositivo(id) {
  const lista = carregarDispositivos();
  const idx = lista.findIndex(d => d.id === id);
  if (idx === -1) {
    throw new Error('Dispositivo não encontrado.');
  }

  const nome = lista[idx].nome;
  lista[idx].ativo = false;
  // Invalida o token de sessão
  lista[idx].sessionToken = 'revogado_' + Date.now();
  salvarDispositivos(lista);

  console.log(`[DISPOSITIVOS] Aparelho desconectado pelo computador: ${nome}`);

  return {
    ok: true,
    mensagem: `Aparelho ${nome} foi desconectado com sucesso.`
  };
}

/**
 * Remove o histórico de um dispositivo
 */
function removerDispositivo(id) {
  let lista = carregarDispositivos();
  const antes = lista.length;
  lista = lista.filter(d => d.id !== id);
  if (lista.length !== antes) {
    salvarDispositivos(lista);
  }
  return { ok: true };
}

/**
 * Valida se um token de sessão do celular ainda está ativo
 */
function validarSessao(sessionToken) {
  if (!sessionToken) return { valido: false };
  const lista = carregarDispositivos();
  const disp = lista.find(d => d.sessionToken === sessionToken && d.ativo === true);

  if (!disp) {
    return { valido: false };
  }

  // Atualiza último acesso a cada 5 minutos
  const agora = Date.now();
  const ultimo = new Date(disp.ultimoAcesso || 0).getTime();
  if (agora - ultimo > 5 * 60 * 1000) {
    disp.ultimoAcesso = new Date().toISOString();
    salvarDispositivos(lista);
  }

  return {
    valido: true,
    usuario: disp.usuario,
    papel: disp.papel,
    nome: disp.nome
  };
}

module.exports = {
  gerarTokenPareamento,
  registrarDispositivo,
  listarDispositivos,
  desconectarDispositivo,
  removerDispositivo,
  validarSessao
};
