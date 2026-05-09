@echo off
REM API Gateway 测试运行脚本 (Windows)

setlocal

echo ================================
echo API Gateway 测试套件
echo ================================
echo.

REM 检查环境变量
if "%API_KEY%"=="" (
  echo 警告: API_KEY 环境变量未设置，使用默认值 'testkey'
  set API_KEY=testkey
)

if "%API_BASE%"=="" (
  echo 警告: API_BASE 环境变量未设置，使用默认值 'http://localhost:3099'
  set API_BASE=http://localhost:3099
)

echo 测试配置:
echo   API_BASE: %API_BASE%
echo   API_KEY: %API_KEY%
echo.

REM 检查服务是否运行
echo 检查 API Gateway 服务状态...
curl -s -f "%API_BASE%/health" >nul 2>&1
if %errorlevel% equ 0 (
  echo √ API Gateway 服务正在运行
) else (
  echo × API Gateway 服务未运行
  echo.
  echo 请先启动 API Gateway 服务:
  echo   cd openclaw
  echo   set API_GATEWAY_KEY=%API_KEY%
  echo   pnpm start
  exit /b 1
)

echo.
echo 开始运行测试...
echo ================================
echo.

REM 进入测试目录
cd /d "%~dp0"

REM 安装依赖（如果需要）
if not exist "node_modules" (
  echo 安装测试依赖...
  call npm install
  echo.
)

REM 运行测试
call npm test

echo.
echo ================================
echo 测试完成
echo ================================

endlocal
