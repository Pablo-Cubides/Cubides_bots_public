param(
    [Parameter()][string]$DailyTime = '08:00',
    [Parameter()][string]$NightlyTime = '21:30',
    [Parameter()][string]$SundayTime = '17:00'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir '..')
$routineScript = Join-Path $repoRoot 'scripts\invoke-agent-routine.ps1'
$coachRemindersScript = Join-Path $repoRoot 'scripts\start-coach-reminders.ps1'

if (-not (Test-Path $routineScript)) {
    throw 'No se encontró scripts/invoke-agent-routine.ps1'
}
if (-not (Test-Path $coachRemindersScript)) {
    throw 'No se encontró scripts/start-coach-reminders.ps1'
}

$dailyAction = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ("-NoProfile -ExecutionPolicy Bypass -File `"{0}`" -Agent all -Routine daily_improvement_plan" -f $routineScript)
$dailyTrigger = New-ScheduledTaskTrigger -Daily -At $DailyTime
Register-ScheduledTask -TaskName 'Agents Daily Morning Plan' -Action $dailyAction -Trigger $dailyTrigger -Description 'Ejecuta una rutina conversacional de mañana por Slack para cada agente.' -Force | Out-Null

$nightlyAction = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ("-NoProfile -ExecutionPolicy Bypass -File `"{0}`" -Agent all -Routine nightly_review" -f $routineScript)
$nightlyTrigger = New-ScheduledTaskTrigger -Daily -At $NightlyTime
Register-ScheduledTask -TaskName 'Agents Nightly Review' -Action $nightlyAction -Trigger $nightlyTrigger -Description 'Ejecuta una rutina nocturna conversacional de memoria y cierre por Slack.' -Force | Out-Null

$sundayAction = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ("-NoProfile -ExecutionPolicy Bypass -File `"{0}`" -Agent all -Routine sunday_roundtable" -f $routineScript)
$sundayTrigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At $SundayTime
Register-ScheduledTask -TaskName 'Agents Sunday Roundtable' -Action $sundayAction -Trigger $sundayTrigger -Description 'Ejecuta la preparación conversacional dominical multi-agente por Slack.' -Force | Out-Null

$coachRemindersAction = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ("-NoProfile -ExecutionPolicy Bypass -File `"{0}`" -Detached" -f $coachRemindersScript)
$coachRemindersTrigger = New-ScheduledTaskTrigger -AtLogOn
$currentUser = if ($env:USERDOMAIN) { "$env:USERDOMAIN\$env:USERNAME" } else { $env:USERNAME }
$coachPrincipal = New-ScheduledTaskPrincipal -UserId $currentUser -LogonType Interactive -RunLevel Limited
$coachRemindersRegistered = $false
try {
    Register-ScheduledTask -TaskName 'Coach Proactive Reminders' -Action $coachRemindersAction -Trigger $coachRemindersTrigger -Principal $coachPrincipal -Description 'Mantiene activo el runner local de recordatorios proactivos de Coach por Slack.' -Force -ErrorAction Stop | Out-Null
    $coachRemindersRegistered = $true
} catch {
    Write-Warning ("No se pudo registrar 'Coach Proactive Reminders' en Task Scheduler: {0}. El runner puede iniciarse manualmente con .\scripts\start-coach-reminders.ps1 -Detached." -f $_.Exception.Message)
}

Write-Host 'Rutinas programadas en Windows Task Scheduler.' -ForegroundColor Green
Write-Host ("- Morning plan: todos los días a las {0}" -f $DailyTime) -ForegroundColor Gray
Write-Host ("- Nightly review: todos los días a las {0}" -f $NightlyTime) -ForegroundColor Gray
Write-Host ("- Sunday roundtable: domingos a las {0}" -f $SundayTime) -ForegroundColor Gray
if ($coachRemindersRegistered) {
    Write-Host "- Coach reminders: al iniciar sesión de Windows" -ForegroundColor Gray
} else {
    Write-Host "- Coach reminders: activo manualmente; autoarranque no registrado por permisos de Windows" -ForegroundColor Yellow
}

