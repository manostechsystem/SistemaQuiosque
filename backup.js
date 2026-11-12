/**
 * Módulo de Backup Inteligente & Disaster Recovery por CNPJ
 * Rota do Forte / Quiosques
 *
 * Características:
 * - Compressão GZIP (.json.gz) - redução de ~75% no tamanho do arquivo (~10 KB)
 * - Rotação automática de 15 dias (descarta arquivos mais antigos)
 * - Disparo automático no fechamento de caixa
 * - Disparo programado inteligente (a cada 3 horas, apenas se houver vendas novas)
 * - Recuperação e restauração completa por CNPJ em novos computadores
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const DATA_DIR = path.join(__dirname, 'dados');
const DATA_FILE = path.join(DATA_DIR, 'pdv.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups_nuvem');
const DIAS_RETENCAO = 15;

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

let ultimaQtdVendasBackup = -1;
let ultimoTimestampBackup = 0;

function limparCnpj(cnpj) {
  const limpo = String(cnpj || '').replace(/\D/g, '');
  return limpo.length >= 8 ? limpo : 'SEM_CNPJ';
}

/**
 * Cria um backup compactado GZIP no repositório de nuvem/disco
 * @param {string} motivo Ex: 'fechamento_caixa', 'rotina_3h', 'manual'
 */
function gerarBackup(motivo = 'rotina') {
  if (!fs.existsSync(DATA_FILE)) return null;

  try {
    const rawData = fs.readFileSync(DATA_FILE, 'utf8');
    const db = JSON.parse(rawData);

    const cnpj = limparCnpj(db.config?.cnpj);
    const nomeLoja = (db.config?.loja || 'Quiosque').replace(/[^a-zA-Z0-9_-]/g, '_');
    const agora = new Date();
    const dataIso = agora.toISOString().replace(/[:.]/g, '-').slice(0, 19);

    const qtdVendas = Array.isArray(db.vendas) ? db.vendas.length : 0;
    const qtdProdutos = Array.isArray(db.produtos) ? db.produtos.length : 0;

    // Metadados do cabeçalho de recuperação
    const meta = {
      cnpj,
      loja: db.config?.loja || 'Quiosque',
      data: agora.toISOString(),
      motivo,
      qtdVendas,
      qtdProdutos,
      versaoSistema: '1.0.0'
    };

    const envelope = {
      meta,
      dados: db
    };

    const bufferGzip = zlib.gzipSync(Buffer.from(JSON.stringify(envelope), 'utf8'));

    const nomeArquivo = `backup_${cnpj}_${dataIso}_${motivo}.json.gz`;
    const caminhoCompleto = path.join(BACKUP_DIR, nomeArquivo);

    fs.writeFileSync(caminhoCompleto, bufferGzip);

    ultimaQtdVendasBackup = qtdVendas;
    ultimoTimestampBackup = agora.getTime();

    // Executa a limpeza dos backups com mais de 15 dias
    limparBackupsAntigos();

    console.log(`[BACKUP AUTOMÁTICO] Gerado com sucesso: ${nomeArquivo} (${(bufferGzip.length / 1024).toFixed(1)} KB) - Motivo: ${motivo}`);

    return {
      ok: true,
      arquivo: nomeArquivo,
      tamanhoBytes: bufferGzip.length,
      meta
    };
  } catch (err) {
    console.error('[BACKUP] Erro ao gerar backup:', err);
    return { ok: false, erro: err.message };
  }
}

/**
 * Remove backups que ultrapassaram o período de retenção de 15 dias
 */
function limparBackupsAntigos() {
  try {
    if (!fs.existsSync(BACKUP_DIR)) return;
    const agora = Date.now();
    const limiteMs = DIAS_RETENCAO * 24 * 60 * 60 * 1000;

    const arquivos = fs.readdirSync(BACKUP_DIR);
    let removidos = 0;

    arquivos.forEach(arq => {
      if (!arq.endsWith('.json.gz')) return;
      const caminho = path.join(BACKUP_DIR, arq);
      const stats = fs.statSync(caminho);
      if (agora - stats.mtimeMs > limiteMs) {
        fs.unlinkSync(caminho);
        removidos++;
      }
    });

    if (removidos > 0) {
      console.log(`[BACKUP] Limpeza concluída: ${removidos} arquivo(s) com mais de ${DIAS_RETENCAO} dias removidos.`);
    }
  } catch (err) {
    console.warn('[BACKUP] Falha na limpeza de backups antigos:', err);
  }
}

/**
 * Lista os backups disponíveis para um determinado CNPJ
 * @param {string} cnpjFiltro CNPJ do quiosque
 */
function listarBackups(cnpjFiltro) {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  const cnpjLimpo = limparCnpj(cnpjFiltro);

  try {
    const arquivos = fs.readdirSync(BACKUP_DIR);
    const lista = [];

    arquivos.forEach(arq => {
      if (!arq.endsWith('.json.gz')) return;
      // Filtra por CNPJ caso informado (ou lista todos se CNPJ for geral)
      if (cnpjLimpo && !arq.includes(cnpjLimpo) && cnpjLimpo !== 'SEM_CNPJ') {
        return;
      }

      const caminho = path.join(BACKUP_DIR, arq);
      const stats = fs.statSync(caminho);

      // Lê os metadados rápidos do arquivo
      try {
        const conteudo = zlib.gunzipSync(fs.readFileSync(caminho)).toString('utf8');
        const envelope = JSON.parse(conteudo);
        lista.push({
          arquivo: arq,
          tamanhoKb: (stats.size / 1024).toFixed(1),
          dataArquivo: stats.mtime.toISOString(),
          meta: envelope.meta || {}
        });
      } catch {
        lista.push({
          arquivo: arq,
          tamanhoKb: (stats.size / 1024).toFixed(1),
          dataArquivo: stats.mtime.toISOString(),
          meta: {}
        });
      }
    });

    return lista.sort((a, b) => new Date(b.dataArquivo) - new Date(a.dataArquivo));
  } catch (err) {
    console.error('[BACKUP] Erro ao listar backups:', err);
    return [];
  }
}

/**
 * Restaura um backup a partir do nome do arquivo
 * Substitui o banco de dados atual com segurança
 */
function restaurarBackup(nomeArquivo) {
  const caminho = path.join(BACKUP_DIR, path.basename(nomeArquivo));
  if (!fs.existsSync(caminho)) {
    throw new Error('Arquivo de backup não encontrado.');
  }

  try {
    const bufferGzip = fs.readFileSync(caminho);
    const rawJson = zlib.gunzipSync(bufferGzip).toString('utf8');
    const envelope = JSON.parse(rawJson);

    const dadosRestaurar = envelope.dados || envelope;

    if (!dadosRestaurar.produtos && !dadosRestaurar.categorias) {
      throw new Error('O arquivo de backup não contém uma estrutura de banco válida.');
    }

    // Cria uma cópia de segurança do banco antes de substituir
    if (fs.existsSync(DATA_FILE)) {
      const bkpSeguranca = DATA_FILE + '.pre_restauro_' + Date.now();
      fs.copyFileSync(DATA_FILE, bkpSeguranca);
    }

    // Gravação atômica do banco restaurado
    const tmp = DATA_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(dadosRestaurar, null, 2), 'utf8');
    fs.renameSync(tmp, DATA_FILE);

    console.log(`[BACKUP RESTAURADO] Sucesso ao restaurar ${nomeArquivo} para ${DATA_FILE}`);

    return {
      ok: true,
      mensagem: 'Banco de dados restaurado com sucesso!',
      meta: envelope.meta || {},
      qtdProdutos: dadosRestaurar.produtos?.length || 0,
      qtdVendas: dadosRestaurar.vendas?.length || 0
    };
  } catch (err) {
    console.error('[BACKUP] Erro ao restaurar backup:', err);
    throw err;
  }
}

/**
 * Verificação inteligente a cada 3 horas:
 * Só gera backup se houve novas vendas desde o último envio
 */
function verificarRotinaInteligente() {
  if (!fs.existsSync(DATA_FILE)) return;
  try {
    const db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    const qtdVendasAtual = Array.isArray(db.vendas) ? db.vendas.length : 0;

    // Se é a primeira execução ou se houve vendas novas desde o último backup
    if (ultimaQtdVendasBackup === -1 || qtdVendasAtual > ultimaQtdVendasBackup) {
      console.log(`[ROTINA DE BACKUP] Vendas novas detectadas (${qtdVendasAtual} total). Disparando backup inteligente...`);
      gerarBackup('rotina_3h');
    } else {
      console.log(`[ROTINA DE BACKUP] Quiosque sem novas vendas desde o último backup. Envio dispensado para economia de tráfego.`);
    }
  } catch (err) {
    console.warn('[ROTINA DE BACKUP] Falha na checagem:', err);
  }
}

// Inicia o timer inteligente a cada 3 horas (3 * 60 * 60 * 1000 ms)
const INTERVALO_3_HORAS = 3 * 60 * 60 * 1000;
setInterval(verificarRotinaInteligente, INTERVALO_3_HORAS);

// Executa uma primeira checagem 10 segundos após a inicialização
setTimeout(verificarRotinaInteligente, 10000);

module.exports = {
  gerarBackup,
  listarBackups,
  restaurarBackup,
  limparBackupsAntigos
};
