# ============================================================
# DPP Trust System - Development Shutdown Script
# ============================================================
# Dit script stopt alle development services:
# - Node.js processen (Frontend, Backend, Hardhat)
# - PostgreSQL container
# ============================================================

param(
    [switch]$RemoveDatabase,
    [switch]$Force
)

$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Yellow
Write-Host "  DPP Trust System - Stopping Services" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Yellow
Write-Host ""

# ============================================================
# 1. Stop Node.js processes (Backend, Frontend, Hardhat)
# ============================================================
Write-Host "[1/3] Stopping Node.js services..." -ForegroundColor Yellow

$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue

if ($nodeProcesses) {
    $count = ($nodeProcesses | Measure-Object).Count
    
    if ($Force) {
        $nodeProcesses | Stop-Process -Force
        Write-Host "      > Force stopped $count Node.js process(es)" -ForegroundColor Green
    }
    else {
        Write-Host "      Found $count Node.js process(es)" -ForegroundColor Gray
        Write-Host "      Stopping gracefully..." -ForegroundColor Gray
        
        foreach ($proc in $nodeProcesses) {
            try {
                $proc | Stop-Process -ErrorAction Stop
            }
            catch {
                $proc | Stop-Process -Force -ErrorAction SilentlyContinue
            }
        }
        Write-Host "      > Stopped all Node.js processes" -ForegroundColor Green
    }
}
else {
    Write-Host "      No Node.js processes running" -ForegroundColor Gray
}

# ============================================================
# 2. PostgreSQL Container
# ============================================================
Write-Host ""
Write-Host "[2/3] PostgreSQL Database..." -ForegroundColor Yellow

$containerRunning = podman ps --filter "name=dpp-postgres" --format "{{.Names}}" 2>$null

if ($containerRunning -eq "dpp-postgres") {
    if ($RemoveDatabase) {
        Write-Host "      Removing container (data will be lost)..." -ForegroundColor Red
        podman rm -f dpp-postgres | Out-Null
        Write-Host "      > Container removed" -ForegroundColor Green
    }
    else {
        Write-Host "      Stopping container (data preserved)..." -ForegroundColor Gray
        podman stop dpp-postgres | Out-Null
        Write-Host "      > Container stopped" -ForegroundColor Green
        Write-Host "      Tip: Use -RemoveDatabase to delete container" -ForegroundColor DarkGray
    }
}
else {
    Write-Host "      Container not running" -ForegroundColor Gray
}

# ============================================================
# 3. Close PowerShell windows opened by start-dev.ps1
# ============================================================
Write-Host ""
Write-Host "[3/3] Closing development PowerShell windows..." -ForegroundColor Yellow

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$PidFile = Join-Path $ProjectRoot ".dev-pids"

$closedCount = 0
if (Test-Path $PidFile) {
    $pids = Get-Content $PidFile
    foreach ($line in $pids) {
        $parts = $line -split ":"
        if ($parts.Count -eq 2) {
            $serviceName = $parts[0]
            $processId = [int]$parts[1]
            try {
                $proc = Get-Process -Id $processId -ErrorAction SilentlyContinue
                if ($proc) {
                    $proc | Stop-Process -Force -ErrorAction SilentlyContinue
                    $closedCount++
                    Write-Host "      > Closed $serviceName window (PID: $processId)" -ForegroundColor Gray
                }
            }
            catch {
                # Process already closed
            }
        }
    }
    # Remove PID file
    Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
    
    if ($closedCount -gt 0) {
        Write-Host "      > Closed $closedCount PowerShell window(s)" -ForegroundColor Green
    }
    else {
        Write-Host "      Windows already closed" -ForegroundColor Gray
    }
}
else {
    Write-Host "      No tracked windows found" -ForegroundColor Gray
}

# ============================================================
# Summary
# ============================================================
Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  All services stopped" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  What was stopped:" -ForegroundColor White
Write-Host "    - Frontend Dev Server (port 5173)" -ForegroundColor Gray
Write-Host "    - Backend Identity Service (port 3000)" -ForegroundColor Gray
Write-Host "    - Hardhat Blockchain Node (port 8545)" -ForegroundColor Gray
Write-Host "    - PostgreSQL Database (port 5432)" -ForegroundColor Gray
Write-Host ""
Write-Host "  To restart: .\start-dev.ps1" -ForegroundColor Cyan
Write-Host ""
