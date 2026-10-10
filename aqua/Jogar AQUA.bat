@echo off
chcp 65001 >nul
title AQUA: Dream of Tomorrow
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 goto semnode

if exist node_modules goto iniciar
echo.
echo  Primeira vez: instalando as dependencias, aguarde...
echo.
call npm.cmd install
if errorlevel 1 goto erro

:iniciar
echo.
echo  ==========================================================
echo    AQUA: Dream of Tomorrow
echo    O jogo vai abrir no navegador em alguns segundos.
echo    Se nao abrir, acesse:  http://localhost:5173
echo.
echo    Para SAIR: feche esta janela preta.
echo  ==========================================================
echo.
call npm.cmd run jogar
goto fim

:semnode
echo.
echo  Node.js nao foi encontrado neste computador.
echo  Instale a versao LTS em https://nodejs.org e tente de novo.
echo.
pause
exit /b 1

:erro
echo.
echo  Algo deu errado na instalacao. Copie a mensagem acima e peca ajuda.
echo.
pause
exit /b 1

:fim
pause
