Write-Host "Starting MusicApp..." -ForegroundColor Green
Write-Host ""
Write-Host "This will start both backend and frontend servers" -ForegroundColor Yellow
Write-Host "Backend will run on: http://localhost:5000" -ForegroundColor Cyan
Write-Host "Frontend will run on: http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop all servers" -ForegroundColor Red
Write-Host ""

# Change to the project directory
Set-Location $PSScriptRoot

# Start both servers
npm start 