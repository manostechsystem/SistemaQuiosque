const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pdv', {
  ler: () => ipcRenderer.invoke('db:ler'),
  salvar: (dados) => ipcRenderer.invoke('db:salvar', dados),
  imprimirCupom: (html, larguraMm, silencioso, impressora) =>
    ipcRenderer.invoke('cupom:imprimir', { html, larguraMm, silencioso, impressora }),
  listarImpressoras: () => ipcRenderer.invoke('sistema:listar-impressoras'),
  selecionarXmlNfe: () => ipcRenderer.invoke('nfe:selecionar-xml'),
  salvarContabilidade: (nomeArquivo, conteudoZipOuXml, tipo) =>
    ipcRenderer.invoke('contabilidade:salvar-pacote', { nomeArquivo, conteudoZipOuXml, tipo }),
  exportarBackup: () => ipcRenderer.invoke('dados:exportar'),
  hashSenha: (senha) => ipcRenderer.invoke('auth:hash', senha),
  conferirSenha: (senha, guardado) => ipcRenderer.invoke('auth:conferir', { senha, guardado })
});
