$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$base = 'C:\AnyDjBuild'
$tools = 'C:\AnyDjTools'
New-Item -ItemType Directory -Force -Path $base, $tools | Out-Null
Start-Transcript -Path 'C:\AnyDjInit\bootstrap.log' -Append
try {
    $metadata = Get-Content 'C:\AnyDjInit\bootstrap.json' -Raw | ConvertFrom-Json
    $user = $metadata.user
    $key = $metadata.publicKey
    $principal = "*" + (Get-LocalUser -Name $user).SID.Value
    $ssh = 'C:\ProgramData\ssh'
    Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0 | Out-Null
    Stop-Service sshd -ErrorAction SilentlyContinue
    New-Item -ItemType Directory -Force -Path $ssh | Out-Null
    Copy-Item 'C:\AnyDjInit\ssh_host_ed25519_key*' $ssh -Force
    & icacls "$ssh\ssh_host_ed25519_key" /inheritance:r /grant:r '*S-1-5-18:F' '*S-1-5-32-544:F' | Out-Null
    @"
Port 22
HostKey C:/ProgramData/ssh/ssh_host_ed25519_key
PubkeyAuthentication yes
PasswordAuthentication no
KbdInteractiveAuthentication no
AllowUsers $user
AuthorizedKeysFile .ssh/authorized_keys
Subsystem sftp sftp-server.exe
"@ | Set-Content "$ssh\sshd_config" -Encoding ascii
    $profile = "C:\Users\$user"
    New-Item -ItemType Directory -Force -Path "$profile\.ssh" | Out-Null
    $key | Set-Content "$profile\.ssh\authorized_keys" -Encoding ascii
    & icacls "$profile\.ssh" /inheritance:r /grant:r "${principal}:(OI)(CI)F" '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' | Out-Null
    & icacls "$profile\.ssh" /setowner $principal /T | Out-Null
    & icacls $base /grant "${principal}:(OI)(CI)M" | Out-Null
    if (!(Get-NetFirewallRule -Name 'OpenSSH-Server-In-TCP' -ErrorAction SilentlyContinue)) {
        New-NetFirewallRule -Name 'OpenSSH-Server-In-TCP' -DisplayName 'AnyDj build SSH' -Enabled True -Direction Inbound -Protocol TCP -Action Allow -LocalPort 22 | Out-Null
    }
    Enable-NetFirewallRule -Name 'OpenSSH-Server-In-TCP'
    Set-NetFirewallRule -Name 'OpenSSH-Server-In-TCP' -Profile Any
    # Install vendor-signed Python and checksum-verified Node; never run arbitrary URLs.
    $nodeVersion = $metadata.nodeVersion
    $nodeName = "node-v$nodeVersion-win-x64.zip"
    $nodeBase = "https://nodejs.org/dist/v$nodeVersion"
    Invoke-WebRequest "$nodeBase/SHASUMS256.txt" -OutFile "$tools\node-shasums.txt"
    $line = Get-Content "$tools\node-shasums.txt" | Where-Object { $_ -match "  $([regex]::Escape($nodeName))`$" }
    if (!$line) { throw 'Node checksum missing' }
    Invoke-WebRequest "$nodeBase/$nodeName" -OutFile "$tools\node.zip"
    if ((Get-FileHash "$tools\node.zip" -Algorithm SHA256).Hash -ne ($line -split '\s+')[0]) { throw 'Node checksum mismatch' }
    Expand-Archive "$tools\node.zip" -DestinationPath $tools -Force
    $nodeDir = "$tools\node-v$nodeVersion-win-x64"
    $pythonVersion = $metadata.pythonVersion
    $pythonInstaller = "$tools\python-installer.exe"
    Invoke-WebRequest "https://www.python.org/ftp/python/$pythonVersion/python-$pythonVersion-amd64.exe" -OutFile $pythonInstaller
    if ((Get-AuthenticodeSignature $pythonInstaller).Status -ne 'Valid') { throw 'Python vendor signature invalid' }
    $install = Start-Process $pythonInstaller -ArgumentList @('/quiet', 'InstallAllUsers=1', 'PrependPath=1', 'Include_test=0', "TargetDir=$tools\Python") -Wait -PassThru
    if ($install.ExitCode -notin @(0,3010)) { throw "Python installer failed: $($install.ExitCode)" }
    $machinePath = [Environment]::GetEnvironmentVariable('Path','Machine')
    [Environment]::SetEnvironmentVariable('Path', "$nodeDir;$tools\Python;$tools\Python\Scripts;$machinePath", 'Machine')
    powercfg.exe /setacvalueindex SCHEME_CURRENT SUB_BUTTONS PBUTTONACTION 3
    powercfg.exe /setdcvalueindex SCHEME_CURRENT SUB_BUTTONS PBUTTONACTION 3
    powercfg.exe /setactive SCHEME_CURRENT
    $crtInstaller = "$tools\vc_redist.x64.exe"
    Invoke-WebRequest 'https://aka.ms/vc14/vc_redist.x64.exe' -OutFile $crtInstaller
    if ((Get-AuthenticodeSignature $crtInstaller).Status -ne 'Valid') { throw 'Microsoft CRT signature invalid' }
    $crt = Start-Process $crtInstaller -ArgumentList @('/install','/quiet','/norestart') -Wait -PassThru
    if ($crt.ExitCode -notin @(0,3010,1638)) { throw "Microsoft CRT installer failed: $($crt.ExitCode)" }
    Set-Service sshd -StartupType Automatic
    Start-Service sshd
    'ready' | Set-Content 'C:\AnyDjInit\bootstrap-ready' -Encoding ascii
    Unregister-ScheduledTask -TaskName 'AnyDjBootstrap' -Confirm:$false
} catch {
    $_ | Out-String | Set-Content 'C:\AnyDjInit\bootstrap-error.txt'
    throw
} finally {
    Stop-Transcript
}
