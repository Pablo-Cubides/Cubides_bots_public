param(
    [Parameter()][switch]$StartAgents,
    [Parameter()][switch]$StartSlackBridge
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir '..')
$targetScript = Join-Path $repoRoot 'scripts\start-command-center.ps1'
$desktop = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktop 'Centro de Mando Multi-Agente.lnk'

$arguments = @('-NoExit', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$targetScript`"")
if ($StartAgents) {
    $arguments += '-StartAgents'
}
if ($StartSlackBridge) {
    $arguments += '-StartSlackBridge'
}

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = 'powershell.exe'
$shortcut.Arguments = ($arguments -join ' ')
$shortcut.WorkingDirectory = $repoRoot
$shortcut.WindowStyle = 1
$shortcut.Description = 'Abre Docker Desktop si hace falta y lanza el Centro de Mando Multi-Agente.'
$shortcut.Save()

Write-Host ("Acceso directo creado: {0}" -f $shortcutPath) -ForegroundColor Green
Write-Host 'Puedes hacer doble clic ahi despues de reiniciar el PC.'


