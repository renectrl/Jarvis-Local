$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$StartupDir = [Environment]::GetFolderPath("Startup")
$ShortcutPath = Join-Path $StartupDir "Jarvis Local Dev.lnk"
$TargetPath = Join-Path $ProjectRoot "scripts\start-jarvis-dev.bat"

$Shell = New-Object -ComObject WScript.Shell
$Shortcut = $Shell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = $TargetPath
$Shortcut.WorkingDirectory = $ProjectRoot
$Shortcut.WindowStyle = 7
$Shortcut.Description = "Start Jarvis Local in lite mode"
$Shortcut.Save()

Write-Host "Autostart shortcut created:"
Write-Host $ShortcutPath
