@echo off
rem Rodado pelo Agendador de Tarefas do Windows: busca os voos e publica o site.
cd /d "%~dp0"
node atualizar.js
