$port = 5173
$existing = netstat -ano | Select-String ":$port " | ForEach-Object {
    ($_ -split '\s+')[-1]
} | Select-Object -Unique

if ($existing) {
    Write-Host "Puerto $port ya en uso (PID $existing). Cerrando..."
    $existing | ForEach-Object { taskkill /PID $_ /F | Out-Null }
    Start-Sleep -Milliseconds 500
}

Write-Host "Arrancando Theme Park Vibes en http://localhost:$port ..."
npm run dev
