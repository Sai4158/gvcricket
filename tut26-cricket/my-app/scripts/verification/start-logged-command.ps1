<#
File overview:
Purpose: Starts a local Windows command and writes readable stdout and stderr logs under artifacts/logs.
Main exports: script side effects only.
Major callers: manual local verification and maintenance runs.
Side effects: creates log files under artifacts/logs and starts the requested process.
Read next: ../README.md
#>

param(
  [Parameter(Mandatory = $true)]
  [string]$TaskName,

  [Parameter(Mandatory = $true)]
  [string]$FilePath,

  [string[]]$ArgumentList = @(),

  [ValidateSet('dev', 'e2e', 'audit', 'checks')]
  [string]$LogGroup = 'checks',

  [switch]$Wait
)

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\\..')
$logRoot = Join-Path $repoRoot "artifacts\\logs\\$LogGroup"
New-Item -ItemType Directory -Force -Path $logRoot | Out-Null

$safeTaskName = ($TaskName -replace '^[\\.-]+', '') -replace '[^A-Za-z0-9\\-]+', '-'
$stdoutPath = Join-Path $logRoot "$safeTaskName.out.log"
$stderrPath = Join-Path $logRoot "$safeTaskName.err.log"

$startInfo = @{
  FilePath = $FilePath
  ArgumentList = $ArgumentList
  WorkingDirectory = $repoRoot
  RedirectStandardOutput = $stdoutPath
  RedirectStandardError = $stderrPath
  PassThru = $true
  NoNewWindow = $true
}

$process = Start-Process @startInfo

Write-Host "Started $TaskName"
Write-Host "PID: $($process.Id)"
Write-Host "STDOUT: $stdoutPath"
Write-Host "STDERR: $stderrPath"

if ($Wait) {
  $process.WaitForExit()
  exit $process.ExitCode
}
