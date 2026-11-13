// Mock para visualização do PDV diretamente no navegador e sincronização Mobile/Cloudflare
if (!window.pdv) {
  const STORAGE_KEY = 'manostech_system_pdv_dados';
  window.pdv = {
    ler: async () => {
      // 1. Tenta sincronizar com o servidor da loja (PC principal via Wi-Fi)
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 2000);
        const resp = await fetch('/api/db', { cache: 'no-store', signal: ctrl.signal });
        clearTimeout(timer);
        if (resp.ok) {
          const dados = await resp.json();
          if (dados && (dados.produtos?.length || dados.categorias?.length)) {
            try { localStorage.setItem(STORAGE_KEY, JSON.stringify(dados)); } catch {}
            return dados;
          }
        }
      } catch {}

      // 2. Se falhar (ex: no 4G / fora do Wi-Fi da loja), busca na Nuvem Cloudflare KV
      try {
        const cfgLocal = (() => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY))?.config || {}; } catch { return {}; } })();
        const cnpjLimpo = (cfgLocal.cnpj || '').replace(/\D/g, '') || 'SEM_CNPJ';
        const cfTok = atob('Y2Z1dF82UkFoSGZiYndUbDM4amVlSm16YW5PbGRDWnJ5YU52SXVTTFFRS2xkNDdmYzJhZjQ=');
        const cfAcc = 'e5fcb255542479b93a6572ebf53b2623';
        const cfNs = 'cc594b8cbb354416842c419c6566d80b';
        const urlKv = `https://api.cloudflare.com/client/v4/accounts/${cfAcc}/storage/kv/namespaces/${cfNs}/values/backup_${cnpjLimpo}_latest`;
        
        const resKv = await fetch(urlKv, { headers: { 'Authorization': `Bearer ${cfTok}` } });
        if (resKv.ok) {
          const env = await resKv.json();
          if (env && env.dadosGzipBase64) {
            const raw = Uint8Array.from(atob(env.dadosGzipBase64), c => c.charCodeAt(0));
            const ds = new Response(raw).body.pipeThrough(new DecompressionStream('gzip'));
            const text = await new Response(ds).text();
            const dec = JSON.parse(text);
            const dados = dec.dados || dec;
            if (dados && (dados.produtos || dados.vendas)) {
              try { localStorage.setItem(STORAGE_KEY, JSON.stringify(dados)); } catch {}
              return dados;
            }
          }
        }
      } catch (errCloud) {
        console.warn('[4G / CLOUDFLARE SYNC]', errCloud.message);
      }

      // 3. Fallback para o armazenamento local caso offline
      try {
        const item = localStorage.getItem(STORAGE_KEY);
        return item ? JSON.parse(item) : null;
      } catch {
        return null;
      }
    },
    salvar: async (dados) => {
      // 1. Salva no localStorage local
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(dados));
      } catch {}

      // 2. Persiste no servidor do quiosque em background
      try {
        await fetch('/api/db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dados)
        });
        return true;
      } catch {
        return true;
      }
    },
    imprimirCupom: async (html, largura, silencioso, impressora) => {
      console.log('Imprimir cupom:', { largura, impressora });
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
      if (!senha || !guardado) return false;
      const s = String(senha).trim();
      const g = String(guardado).trim();

      if (g.includes(':')) {
        const [salt, hash] = g.split(':');
        // Suporte legado aos primeiros testes do mock (salt:hash-SENHA)
        if (salt === 'salt' && hash.startsWith('hash-')) {
          return s === hash.replace('hash-', '');
        }
        // Formato seguro SHA-256 do browser
        if (salt && hash && salt.length === 32 && hash.length === 64) {
          const encoder = new TextEncoder();
          const data = encoder.encode(salt + ':' + s);
          const hashBuffer = await crypto.subtle.digest('SHA-256', data);
          const calculada = Array.from(new Uint8Array(hashBuffer))
            .map(b => b.toString(16).padStart(2, '0')).join('');
          return calculada === hash;
        }
      }

      // Senha em texto puro inicial ou fallback
      if (g === s || (s === 'admin' && g.toLowerCase() === 'admin')) return true;

      return false;
    }
  };
}
