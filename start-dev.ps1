# ============================================================
# DPP Trust System - Development Startup Script
# ============================================================
# Dit script start alle services voor lokale development:
# - PostgreSQL database (via Podman)
# - Hardhat Blockchain Node (lokale blockchain)
# - Backend Identity Service (port 3000)
# - Frontend Vite Dev Server (port 5173)
# ============================================================

param(
    [switch]$SkipDatabase,
    [switch]$SkipBlockchain,
    [switch]$SkipBackend,
    [switch]$SkipFrontend,
    [switch]$DeployContract
)

$ErrorActionPreference = "Continue"
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$PidFile = Join-Path $ProjectRoot ".dev-pids"

# Clear PID file at start
if (Test-Path $PidFile) {
    Remove-Item $PidFile -Force
}

# Helper function to check if a port is in use
function Test-PortInUse {
    param([int]$Port)
    $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    return ($null -ne $connection)
}

# Helper function to wait for a port to become available
function Wait-ForPort {
    param(
        [int]$Port,
        [int]$TimeoutSeconds = 30
    )
    $elapsed = 0
    while (-not (Test-PortInUse -Port $Port) -and $elapsed -lt $TimeoutSeconds) {
        Start-Sleep -Seconds 1
        $elapsed++
    }
    return (Test-PortInUse -Port $Port)
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  DPP Trust System - Development Environment" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# ============================================================
# 1. PostgreSQL Database (Podman)
# ============================================================
if (-not $SkipDatabase) {
    Write-Host "[1/4] PostgreSQL Database" -ForegroundColor Yellow
    Write-Host "      Checking container status..." -ForegroundColor Gray
    
    $containerExists = podman ps -a --filter "name=dpp-postgres" --format "{{.Names}}" 2>$null
    $containerRunning = podman ps --filter "name=dpp-postgres" --format "{{.Names}}" 2>$null
    
    if ($containerRunning -eq "dpp-postgres") {
        Write-Host "      > Already running on port 5432" -ForegroundColor Green
    }
    elseif ($containerExists -eq "dpp-postgres") {
        Write-Host "      Starting existing container..." -ForegroundColor Gray
        podman start dpp-postgres | Out-Null
        Start-Sleep -Seconds 2
        Write-Host "      > Started on port 5432" -ForegroundColor Green
    }
    else {
        Write-Host "      Creating new container..." -ForegroundColor Gray
        podman run -d --name dpp-postgres -e POSTGRES_USER=dpp_admin -e POSTGRES_PASSWORD=secret123 -e POSTGRES_DB=dpp_db -p 5432:5432 postgres:15-alpine | Out-Null
        
        Write-Host "      Waiting for PostgreSQL to initialize..." -ForegroundColor Gray
        Start-Sleep -Seconds 5
        
        # Load schema
        Write-Host "      Loading database schema..." -ForegroundColor Gray
        $schemaPath = Join-Path $ProjectRoot "backend\db\schema.sql"
        if (Test-Path $schemaPath) {
            Get-Content $schemaPath | podman exec -i dpp-postgres psql -U dpp_admin -d dpp_db 2>$null
        }
        
        # Load seed data (demo products)
        Write-Host "      Loading demo data..." -ForegroundColor Gray
        $seedPath = Join-Path $ProjectRoot "backend\db\seed.sql"
        if (Test-Path $seedPath) {
            Get-Content $seedPath | podman exec -i dpp-postgres psql -U dpp_admin -d dpp_db 2>$null
            Write-Host "      > Created with demo products on port 5432" -ForegroundColor Green
        }
        else {
            Write-Host "      > Created and initialized on port 5432" -ForegroundColor Green
        }
    }
}
else {
    Write-Host "[1/4] PostgreSQL Database - SKIPPED" -ForegroundColor DarkGray
}

# ============================================================
# 2. Hardhat Blockchain Node (Local)
# ============================================================
if (-not $SkipBlockchain) {
    Write-Host ""
    Write-Host "[2/4] Hardhat Blockchain Node" -ForegroundColor Yellow
    
    if (Test-PortInUse -Port 8545) {
        Write-Host "      > Already running on port 8545" -ForegroundColor Green
    }
    else {
        Write-Host "      Starting in new window..." -ForegroundColor Gray
        
        $contractsPath = Join-Path $ProjectRoot "contracts"
        $proc = Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$contractsPath'; Write-Host 'Hardhat Blockchain Node' -ForegroundColor Cyan; Write-Host 'Chain ID: 31337' -ForegroundColor Gray; npx hardhat node --hostname 0.0.0.0" -WindowStyle Normal -PassThru
        Add-Content -Path $PidFile -Value "hardhat:$($proc.Id)"
        
        Write-Host "      Waiting for Hardhat to start..." -ForegroundColor Gray
        $started = Wait-ForPort -Port 8545 -TimeoutSeconds 15
        
        if ($started) {
            # Deploy contract if requested
            if ($DeployContract) {
                Write-Host "      Deploying smart contract..." -ForegroundColor Gray
                Push-Location $contractsPath
                npx hardhat run scripts/deploy.ts --network localhost 2>$null
                Pop-Location
                Write-Host "      > Contract deployed" -ForegroundColor Green
            }
            Write-Host "      > Started on port 8545" -ForegroundColor Green
        }
        else {
            Write-Host "      ! Timeout waiting for Hardhat (may still be starting)" -ForegroundColor Yellow
        }
    }
}
else {
    Write-Host ""
    Write-Host "[2/4] Hardhat Blockchain Node - SKIPPED" -ForegroundColor DarkGray
}

# ============================================================
# 3. Backend Identity Service
# ============================================================
if (-not $SkipBackend) {
    Write-Host ""
    Write-Host "[3/4] Backend Identity Service" -ForegroundColor Yellow
    
    if (Test-PortInUse -Port 3000) {
        Write-Host "      > Already running on port 3000" -ForegroundColor Green
    }
    else {
        Write-Host "      Starting in new window..." -ForegroundColor Gray
        
        $backendPath = Join-Path $ProjectRoot "backend"
        $proc = Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$backendPath'; Write-Host 'Backend Identity Service' -ForegroundColor Cyan; npm run dev:identity" -WindowStyle Normal -PassThru
        Add-Content -Path $PidFile -Value "backend:$($proc.Id)"
        
        Write-Host "      Waiting for Backend to start..." -ForegroundColor Gray
        $started = Wait-ForPort -Port 3000 -TimeoutSeconds 15
        
        if ($started) {
            Write-Host "      > Started on port 3000" -ForegroundColor Green
        }
        else {
            Write-Host "      ! Timeout waiting for Backend (may still be starting)" -ForegroundColor Yellow
        }
    }
}
else {
    Write-Host ""
    Write-Host "[3/4] Backend Identity Service - SKIPPED" -ForegroundColor DarkGray
}

# ============================================================
# 4. Frontend Vite Dev Server
# ============================================================
if (-not $SkipFrontend) {
    Write-Host ""
    Write-Host "[4/4] Frontend Development Server" -ForegroundColor Yellow
    
    if (Test-PortInUse -Port 5173) {
        Write-Host "      > Already running on port 5173" -ForegroundColor Green
    }
    else {
        Write-Host "      Starting in new window..." -ForegroundColor Gray
        
        $proc = Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$ProjectRoot'; Write-Host 'Frontend Dev Server' -ForegroundColor Cyan; npm run dev" -WindowStyle Normal -PassThru
        Add-Content -Path $PidFile -Value "frontend:$($proc.Id)"
        
        Write-Host "      Waiting for Frontend to start..." -ForegroundColor Gray
        $started = Wait-ForPort -Port 5173 -TimeoutSeconds 15
        
        if ($started) {
            Write-Host "      > Started on port 5173" -ForegroundColor Green
        }
        else {
            Write-Host "      ! Timeout waiting for Frontend (may still be starting)" -ForegroundColor Yellow
        }
    }
}
else {
    Write-Host ""
    Write-Host "[4/4] Frontend Development Server - SKIPPED" -ForegroundColor DarkGray
}

# ============================================================
# Final Status Check
# ============================================================
Write-Host ""
Start-Sleep -Seconds 2

$frontendOk = Test-PortInUse -Port 5173
$backendOk = Test-PortInUse -Port 3000
$blockchainOk = Test-PortInUse -Port 8545

if ($frontendOk -and $backendOk -and $blockchainOk) {
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host "  All services started successfully!" -ForegroundColor Green
    Write-Host "============================================================" -ForegroundColor Green
}
else {
    Write-Host "============================================================" -ForegroundColor Yellow
    Write-Host "  Some services may not have started correctly" -ForegroundColor Yellow
    Write-Host "============================================================" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "  Services:" -ForegroundColor White
if ($frontendOk) {
    Write-Host "    Frontend:     http://localhost:5173" -ForegroundColor Green
} else {
    Write-Host "    Frontend:     NOT RUNNING" -ForegroundColor Red
}
if ($backendOk) {
    Write-Host "    Backend API:  http://localhost:3000" -ForegroundColor Green
} else {
    Write-Host "    Backend API:  NOT RUNNING" -ForegroundColor Red
}
if ($blockchainOk) {
    Write-Host "    Blockchain:   http://localhost:8545 (Chain ID: 31337)" -ForegroundColor Green
} else {
    Write-Host "    Blockchain:   NOT RUNNING" -ForegroundColor Red
}
Write-Host "    Database:     localhost:5432" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Quick Links:" -ForegroundColor White
Write-Host "    Health Check: http://localhost:3000/health" -ForegroundColor Gray
Write-Host "    API:          http://localhost:3000/api/identities" -ForegroundColor Gray
Write-Host ""
Write-Host "  Commands:" -ForegroundColor White
Write-Host "    Stop all:           .\stop-dev.ps1" -ForegroundColor Gray
Write-Host "    Stop with cleanup:  .\stop-dev.ps1 -RemoveDatabase" -ForegroundColor Gray
Write-Host "    Deploy contract:    .\start-dev.ps1 -DeployContract" -ForegroundColor Gray
Write-Host ""

# Open browser if frontend is running
if ($frontendOk) {
    Write-Host "  Opening browser..." -ForegroundColor Cyan
    Start-Process "http://localhost:5173"
}
