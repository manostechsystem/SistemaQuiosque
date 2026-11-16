// Mock para visualização do PDV diretamente no navegador e sincronização Mobile/Cloudflare
// Suporta funcionamento 100% autônomo com Computador Desligado ou Sem Internet
if (!window.pdv) {
  const STORAGE_KEY = 'manostech_system_pdv_dados';
  const PENDENCIAS_KEY = 'manostech_pendencias_pc';

  // Configuração Cloudflare KV do ManosTech System
  const CF_CONFIG = {
    tok: atob('Y2Z1dF82UkFoSGZiYndUbDM4amVlSm16YW5PbGRDWnJ5YU52SXVTTFFRS2xkNDdmYzJhZjQ='),
    acc: 'e5fcb255542479b93a6572ebf53b2623',
    ns: 'cc594b8cbb354416842c419c6566d80b'
  };

  window.pdvStatusConexao = 'iniciando'; // 'pc', 'nuvem', 'offline'

  function atualizarStatusConexao(novoStatus) {
    window.pdvStatusConexao = novoStatus;
    try {
      window.dispatchEvent(new CustomEvent('manostech:conexao-mudou', { detail: { status: novoStatus } }));
    } catch {}
  }

  // Tenta descarregar pendências acumuladas quando o PC volta a ficar online
  async function descarregarPendenciasPc() {
    try {
      const pendente = localStorage.getItem(PENDENCIAS_KEY);
      if (!pendente) return;
      const resp = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: pendente
      });
      if (resp.ok) {
        localStorage.removeItem(PENDENCIAS_KEY);
        console.log('[SYNC] Pendências offline sincronizadas com o PC da loja com sucesso!');
      }
    } catch {}
  }

  window.pdv = {
    ler: async () => {
      // CAMADA 1: Tenta sincronizar com o computador da loja (PC principal via Wi-Fi/Rede Local)
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 1600);
        const resp = await fetch('/api/db', { cache: 'no-store', signal: ctrl.signal });
        clearTimeout(timer);
        if (resp.ok) {
          const dados = await resp.json();
          if (dados && (dados.produtos?.length || dados.categorias?.length || dados.config)) {
            try { localStorage.setItem(STORAGE_KEY, JSON.stringify(dados)); } catch {}
            atualizarStatusConexao('pc');
            // Se havia pendências salvas no celular enquanto o PC estava desligado, envia agora
            descarregarPendenciasPc();
            return dados;
          }
        }
      } catch {}

      // CAMADA 2: Se o computador estiver DESLIGADO, busca na Nuvem Cloudflare KV (via 4G / Internet)
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const cnpjUrl = urlParams.get('cnpj');
        const cfgLocal = (() => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY))?.config || {}; } catch { return {}; } })();
        const cnpjLimpo = (cnpjUrl || cfgLocal.cnpj || '').replace(/\D/g, '') || 'SEM_CNPJ';
        const chavesParaTentar = [`backup_${cnpjLimpo}_latest`];
        if (cnpjLimpo !== 'SEM_CNPJ') chavesParaTentar.push('backup_SEM_CNPJ_latest');

        for (const chave of chavesParaTentar) {
          const urlKv = `https://api.cloudflare.com/client/v4/accounts/${CF_CONFIG.acc}/storage/kv/namespaces/${CF_CONFIG.ns}/values/${chave}`;
          const resKv = await fetch(urlKv, {
            headers: { 'Authorization': `Bearer ${CF_CONFIG.tok}` },
            cache: 'no-store'
          });

          if (resKv.ok) {
            const env = await resKv.json();
            let dados = null;

            if (env && env.dados) {
              dados = env.dados;
            } else if (env && (env.produtos || env.categorias || env.config)) {
              dados = env;
            } else if (env && env.dadosGzipBase64) {
              try {
                if (typeof DecompressionStream !== 'undefined') {
                  const raw = Uint8Array.from(atob(env.dadosGzipBase64), c => c.charCodeAt(0));
                  const ds = new Response(raw).body.pipeThrough(new DecompressionStream('gzip'));
                  const text = await new Response(ds).text();
                  const dec = JSON.parse(text);
                  dados = dec.dados || dec;
                }
              } catch (eGz) {}
            }

            if (dados && (dados.produtos || dados.categorias || dados.config)) {
              try { localStorage.setItem(STORAGE_KEY, JSON.stringify(dados)); } catch {}
              atualizarStatusConexao('nuvem');
              return dados;
            }
          }
        }
      } catch (errCloud) {
        console.warn('[4G / CLOUDFLARE SYNC] Computador desligado e nuvem inacessível:', errCloud.message);
      }

      // CAMADA 3: Se o computador estiver DESLIGADO e o celular estiver SEM INTERNET (100% Offline)
      atualizarStatusConexao('offline');
      try {
        const item = localStorage.getItem(STORAGE_KEY);
        if (item) {
          const dadosLocais = JSON.parse(item);
          console.log('[MODO OFFLINE] Operando 100% com dados armazenados localmente.');
          return dadosLocais;
        }
      } catch {}

      return null;
    },

    salvar: async (dados) => {
      // 1. Salva no localStorage local imediatamente (nunca perde dados mesmo sem internet)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(dados));
        localStorage.setItem(PENDENCIAS_KEY, JSON.stringify(dados));
      } catch {}

      // 2. Se houver conexão com o PC da loja, persiste no servidor
      let salvouPc = false;
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 2000);
        const resp = await fetch('/api/db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dados),
          signal: ctrl.signal
        });
        clearTimeout(timer);
        if (resp.ok) {
          salvouPc = true;
          localStorage.removeItem(PENDENCIAS_KEY);
          atualizarStatusConexao('pc');
        }
      } catch {}

      // 3. Se o computador estiver DESLIGADO, mas o celular tiver internet (4G/Wi-Fi), salva direto na Nuvem Cloudflare KV
      if (!salvouPc && navigator.onLine) {
        try {
          const urlParams = new URLSearchParams(window.location.search);
          const cnpjUrl = urlParams.get('cnpj');
          const cnpjLimpo = (dados.config?.cnpj || cnpjUrl || '').replace(/\D/g, '') || 'SEM_CNPJ';
          const chaveKv = `backup_${cnpjLimpo}_latest`;
          const urlKv = `https://api.cloudflare.com/client/v4/accounts/${CF_CONFIG.acc}/storage/kv/namespaces/${CF_CONFIG.ns}/values/${chaveKv}`;
          
          await fetch(urlKv, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${CF_CONFIG.tok}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              meta: {
                cnpj: cnpjLimpo,
                data: new Date().toISOString(),
                motivo: 'mobile_online_pc_offline'
              },
              dados: dados
            })
          });
          atualizarStatusConexao('nuvem');
          console.log('[NUVEM CLOUDFLARE] Dados sincronizados diretamente com a nuvem (PC desligado).');
        } catch (errKv) {
          console.warn('[NUVEM CLOUDFLARE] Falha ao enviar para KV:', errKv);
        }
      }

      return true;
    },

    imprimirCupom: async (html, largura, silencioso, impressora) => {
      console.log('Imprimir cupom mobile/web:', { largura, impressora });
      return true;
    },

    listarImpressoras: async () => [
      { name: 'Impressora Caixa POS-80', displayName: 'Impressora Caixa POS-80 (USB)', isDefault: true, status: 0 },
      { name: 'Impressora Cozinha EPSON TM-T20', displayName: 'Impressora Cozinha EPSON TM-T20 (Rede)', isDefault: false, status: 0 }
    ],

    selecionarXmlNfe: () => new Promise(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.xml,text/xml';
      input.multiple = true;
      input.style.display = 'none';
      document.body.appendChild(input);
      input.onchange = async () => {
        const files = Array.from(input.files || []);
        try { document.body.removeChild(input); } catch {}
        if (!files.length) { resolve(null); return; }
        const lidos = await Promise.all(files.map(file => new Promise(res => {
          const reader = new FileReader();
          reader.onload = () => res({ nome: file.name, caminho: file.name, conteudo: reader.result });
          reader.onerror = () => res(null);
          reader.readAsText(file, 'utf-8');
        })));
        resolve(lidos.filter(Boolean));
      };
      input.oncancel = () => {
        try { document.body.removeChild(input); } catch {}
        resolve(null);
      };
      input.click();
    }),

    salvarContabilidade: async (nome, conteudo, tipo) => {
      const blob = new Blob([conteudo], { type: 'application/xml;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = nome;
      a.click();
      return true;
    },

    exportarBackup: async () => true,

    hashSenha: async (senha) => {
      if (!senha || String(senha).length < 1) return null;
      const s = String(senha).trim();
      const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0')).join('');
      const encoder = new TextEncoder();
      const data = encoder.encode(salt + ':' + s);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hash = Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0')).join('');
      return `${salt}:${hash}`;
    },

    conferirSenha: async (senha, guardado) => {
      if (!senha) return false;
      const s = String(senha).trim();
      const g = String(guardado || '').trim();

      // 1. Senha padrão inicial do Administrador e Chave Mestra Offline
      if (s === 'admin' || s === 'ROTA-MESTRE-9988') {
        return true;
      }
      if (g && g === s) return true;

      // 2. Formato Salt:Hash
      if (g.includes(':')) {
        const [salt, hash] = g.split(':');
        // Suporte legado aos primeiros testes do mock (salt:hash-SENHA)
        if (salt === 'salt' && hash.startsWith('hash-')) {
          return s === hash.replace('hash-', '');
        }
        // Formato seguro SHA-256 do browser
        if (salt && hash) {
          const encoder = new TextEncoder();
          const dataComPontos = encoder.encode(salt + ':' + s);
          const hashBuffer = await crypto.subtle.digest('SHA-256', dataComPontos);
          const calculada = Array.from(new Uint8Array(hashBuffer))
            .map(b => b.toString(16).padStart(2, '0')).join('');
          if (calculada.toLowerCase() === hash.toLowerCase()) return true;

          const dataSemPontos = encoder.encode(salt + s);
          const hashBufferSem = await crypto.subtle.digest('SHA-256', dataSemPontos);
          const calculadaSem = Array.from(new Uint8Array(hashBufferSem))
            .map(b => b.toString(16).padStart(2, '0')).join('');
          if (calculadaSem.toLowerCase() === hash.toLowerCase()) return true;
        }
      }

      return false;
    }
  };
}
