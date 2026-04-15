@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

echo ============================================
echo   AgentNet Standalone Agent - Installer
echo ============================================
echo.

where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH
    echo Install Node.js: https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=1 delims=." %%v in ('node -v 2^>nul') do (
    set NODE_VER=%%v
)
set NODE_VER=%NODE_VER:v=%

if %NODE_VER% lss 18 (
    echo [ERROR] Node.js ^>= 18 is required. Current: 
    node -v
    pause
    exit /b 1
)
echo [OK] Node.js version:
node -v

cd /d "%~dp0.."

if not exist "config\agent.json" (
    copy config\agent.json.example config\agent.json >nul
    echo [OK] Created config\agent.json from template
) else (
    echo [SKIP] config\agent.json already exists
)

if not exist "config\llm.json" (
    copy config\llm.json.example config\llm.json >nul
    echo [OK] Created config\llm.json from template
) else (
    echo [SKIP] config\llm.json already exists
)

echo.
echo Installing npm dependencies...
call npm install --production 2>nul || echo [WARN] npm install failed, core features still work without dependencies

echo.
echo ============================================
echo   Installation complete!
echo ============================================
echo.
echo Next steps:
echo   1. Edit config\agent.json with your API Key
echo   2. (Optional) Edit config\llm.json for LLM support
echo   3. Run: npm start
echo.
echo Or use the setup wizard: npm run setup
echo.
pause
