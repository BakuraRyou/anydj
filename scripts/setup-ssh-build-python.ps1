param([Parameter(Mandatory=$true)][string]$BuildRoot)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$tools = Join-Path $BuildRoot 'tools'
$pythonRoot = Join-Path $tools 'python-3.14.4'
$python = Join-Path $pythonRoot 'python.exe'
if (-not (Test-Path -LiteralPath $python)) {
    New-Item -ItemType Directory -Force -Path $tools | Out-Null
    $installer = Join-Path $tools 'python-3.14.4-amd64.exe'
    Invoke-WebRequest -UseBasicParsing -Uri 'https://www.python.org/ftp/python/3.14.4/python-3.14.4-amd64.exe' -OutFile $installer
    $signature = Get-AuthenticodeSignature -LiteralPath $installer
    if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'Python Software Foundation') {
        throw 'Python-Installersignatur ist ungueltig.'
    }
    # Per-user install, dedicated build folder, no PATH/launcher/file association.
    $arguments = '/quiet InstallAllUsers=0 Include_launcher=0 AssociateFiles=0 PrependPath=0 Include_test=0 Shortcuts=0 TargetDir="' + $pythonRoot + '"'
    $installed = Start-Process -FilePath $installer -ArgumentList $arguments -PassThru -Wait
    if ($installed.ExitCode -ne 0) { throw ('Python-Installation fehlgeschlagen: ' + $installed.ExitCode) }
}
& $python -c 'import sys, platform, venv, ssl; assert sys.version_info[:2] == (3,14) and platform.machine().lower() == ''amd64''; print(sys.executable)'
if ($LASTEXITCODE -ne 0) { throw 'Python-Laufzeitpruefung fehlgeschlagen.' }
