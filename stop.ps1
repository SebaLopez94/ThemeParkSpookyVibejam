$port = 5173
$pids = netstat -ano | Select-String ":$port " | ForEach-Object {
    ($_ -split '\s+')[-1]
} | Select-Object -Unique

if ($pids) {
    $pids | ForEach-Object {
        taskkill /PID $_ /F | Out-Null
        Write-Host "Proceso $_ terminado."
    }
    Write-Host "Servidor apagado."
} else {
    Write-Host "No hay ningún servidor corriendo en el puerto $port."
}
