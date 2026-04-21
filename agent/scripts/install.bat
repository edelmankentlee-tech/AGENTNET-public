@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul 2>&1

echo ============================================
echo   AgentNet Standalone Agent - Installer
echo ============================================
echo.

where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not installed
    echo Download: https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=2 delims=." %%v in ('node -v 2^>nul') do (
    set NODE_MAJOR=%%v
)
set NODE_MAJOR=%NODE_MAJOR:v=%

if %NODE_MAJOR% lss 18 (
    echo [ERROR] Node.js ^>= 18 is required. Current:
    node -v
    pause
    exit /b 1
)
echo [OK] Node.js version:
node -v

set "SCRIPT_DIR=%~dp0"
pushd "%SCRIPT_DIR%.."

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

where npm >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [WARN] npm not found, skip dependency installation
) else (
    echo.
    echo Installing npm dependencies...
    call npm install --omit=dev 2>nul || echo [WARN] npm install failed, core features still work for basic usage
)

echo.
echo Running built-in self-check...
call node src\standalone-agent.js --self-check
if %ERRORLEVEL% neq 0 (
    echo [WARN] Self-check failed, please rerun: node src\standalone-agent.js --self-check
)

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
echo For deployment packages: run scripts\start.sh or scripts\start.bat
echo.
pause

popd
