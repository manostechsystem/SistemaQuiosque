@echo off
chcp 65001 > nul
cls
echo =======================================================================
echo          ROTA DO FORTE — CONEXAO NUVEM (CLOUDFLARE TUNNEL)
echo =======================================================================
echo.
echo Este script conecta o computador do quiosque com o seu celular de forma
echo segura, criptografada (HTTPS) e gratuita via Cloudflare.
echo.
echo 1. Verificando o servidor local na porta 3000...
curl -s http://localhost:3000/api/status > nul
if %errorlevel% neq 0 (
    echo [AVISO] O servidor local nao parece estar ativo.
    echo Iniciando o servidor em background...
    start /b node server.js
    timeout /t 2 > nul
)

echo [OK] Servidor local ativo!
echo.
echo 2. Verificando o utilitario Cloudflared...
where cloudflared > nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] O Cloudflared nao foi detectado instalado no Windows.
    echo.
    echo Para instalar com 1 comando (via winget oficial da Microsoft):
    echo    winget install Cloudflare.cloudflared
    echo.
    echo Ou baixe o executavel direto em:
    echo    https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.msi
    echo.
    pause
    exit /b
)

echo [OK] Cloudflared encontrado!
echo.
echo =======================================================================
echo INICIANDO O TUNEL SEGURO...
echo Copie o link HTTPS que aparecera abaixo e abra no navegador do seu celular!
echo =======================================================================
echo.
cloudflared tunnel --url http://localhost:3000
pause
