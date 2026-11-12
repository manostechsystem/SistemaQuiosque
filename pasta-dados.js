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
