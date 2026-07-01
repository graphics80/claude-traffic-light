# Claude Traffic Light installer (Windows / PowerShell).
# Thin wrapper around the cross-platform Node installer.
#   Run:  powershell -ExecutionPolicy Bypass -File .\install.ps1
$ErrorActionPreference = "Stop"
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
node (Join-Path $dir "install.mjs")
