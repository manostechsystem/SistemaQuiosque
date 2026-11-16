const path = require('path');
const fs = require('fs');

function obterDataDir() {
  try {
    if (process.versions && process.versions.electron) {
      const electron = require('electron');
      const app = electron.app || (electron.remote && electron.remote.app);
      if (app && typeof app.getPath === 'function') {
        const dir = path.join(app.getPath('userData'), 'dados');
        if (!fs.existsSync(dir)) {
          try { fs.mkdirSync(dir, { recursive: true }); } catch (e) {}
        }
        return dir;
      }
    }
  } catch (e) {}

  // Se não estiver dentro do processo do Electron, tenta localizar a pasta oficial do usuário no AppData
  try {
    const appData = process.env.APPDATA;
    if (appData) {
      const possiveisDirs = [
        path.join(appData, 'rota-do-forte-pdv', 'dados'),
        path.join(appData, 'manostech-system', 'dados')
      ];
      for (const d of possiveisDirs) {
        if (fs.existsSync(path.join(d, 'pdv.json'))) {
          return d;
        }
      }
    }
  } catch (e) {}

  const localDir = path.join(__dirname, 'dados');
  if (!fs.existsSync(localDir)) {
    try { fs.mkdirSync(localDir, { recursive: true }); } catch (e) {}
  }
  return localDir;
}

module.exports = {
  DATA_DIR: obterDataDir(),
  obterDataDir
};
