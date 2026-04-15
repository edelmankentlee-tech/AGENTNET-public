@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0.."
echo Starting AgentNet Agent...
node src\standalone-agent.js %*
