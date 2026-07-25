# Set up Transcriber to run automatically on Windows, with no visible windows:
#   - the backend server starts hidden at each login (via a Startup-folder VBS)
#   - the Tailscale Funnel is persisted in the background (survives reboots)
#
# Run once:  powershell -ExecutionPolicy Bypass -File Install-Autostart.ps1
# Undo:      delete the Startup "Transcriber.vbs" and run: tailscale serve reset

$ErrorActionPreference = "Stop"
$proj = $PSScriptRoot

# Use the console python (not pythonw): the app prints to stdout, which is
# None under pythonw and would crash it. The VBS hides the console window
# instead, so there's no visible window but stdout still works.
$py = Join-Path $proj ".venv\Scripts\python.exe"
if (-not (Test-Path $py)) {
    throw "venv not found at $py. Create it first with: py -m venv .venv"
}

# Locate tailscale.exe (PATH, then the default install dir).
$ts = (Get-Command tailscale -ErrorAction SilentlyContinue).Source
if (-not $ts) {
    foreach ($p in "$env:ProgramFiles\Tailscale\tailscale.exe", "${env:ProgramFiles(x86)}\Tailscale\tailscale.exe") {
        if (Test-Path $p) { $ts = $p; break }
    }
}
if (-not $ts) { throw "tailscale.exe not found. Install Tailscale first." }

# 1) Persist the public funnel to localhost:8000 in the background.
& $ts funnel --bg 8000

# 2) Start the server hidden at each login.
$startup = [Environment]::GetFolderPath("Startup")
$vbsPath = Join-Path $startup "Transcriber.vbs"
$vbs = @"
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = "$proj"
q = Chr(34)
sh.Run q & "$py" & q & " -m backend.server", 0, False
"@
Set-Content -LiteralPath $vbsPath -Value $vbs -Encoding ASCII

Write-Host ""
Write-Host "Autostart installed:" -ForegroundColor Green
Write-Host "  Server : hidden at login  ->  $vbsPath"
Write-Host "  Funnel : tailscale funnel --bg 8000 (persisted across reboots)"
Write-Host ""
Write-Host "To remove: delete the Startup Transcriber.vbs and run: tailscale serve reset"
