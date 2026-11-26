[CmdletBinding()]
param(
    [switch]$NoBrowser,
    [switch]$CheckOnly,
    [switch]$Stop,
    [string]$DbPath
)
$ErrorActionPreference = 'Stop'
$branch = 'main'
$entry = Split-Path -Parent $PSScriptRoot
$source = $null
foreach ($line in (& git -C $entry -c core.quotepath=false worktree list --porcelain)) {
    if ($line.StartsWith('worktree ')) { $candidate = $line.Substring(9) }
    if ($line -eq "branch refs/heads/$branch") { $source = (Resolve-Path -LiteralPath $candidate).Path }
}
if (!$source) { throw "No checked-out worktree for $branch. See git worktree list." }

# Always run the main worktree implementation, including from another checkout.
$implementation = Join-Path $source 'scripts\start-local.ps1'
if ((Resolve-Path -LiteralPath $PSCommandPath).Path -ne (Resolve-Path -LiteralPath $implementation).Path) {
    & $implementation @PSBoundParameters
    return
}
$head = & git -C $source rev-parse HEAD
$symbolic = & git -C $source symbolic-ref HEAD
$branchHead = & git -C $source rev-parse "refs/heads/$branch"
if ($LASTEXITCODE -ne 0 -or $symbolic -ne "refs/heads/$branch" -or $head -ne $branchHead) {
    throw "Branch or HEAD changed while locating $source. Please retry."
}
Write-Host "Source: $source"
Write-Host "Branch: $branch"
Write-Host "HEAD:   $head"

if (!$Stop) {
    foreach ($ref in @('refs/heads/feat/huacan-deep-redesign','refs/remotes/origin/feat/huacan-deep-redesign')) {
        & git -C $source show-ref --verify --quiet $ref
        if ($LASTEXITCODE -eq 1) { continue }
        if ($LASTEXITCODE -ne 0) { throw "Could not resolve $ref." }
        & git -C $source merge-base --is-ancestor $ref $head
        if ($LASTEXITCODE -ne 0) { throw "New UI at $ref has not been integrated into $branch. Sync and verify $branch before launching." }
    }
}

$cache = Join-Path $source '.cache\local-start'
$statePath = Join-Path $cache 'processes.json'
$common = & git -C $source rev-parse --path-format=absolute --git-common-dir
$archive = Join-Path (Split-Path -Parent $common) '06_backend\data\holobeat-archive.sqlite'
if ($DbPath) { $archive = [IO.Path]::GetFullPath($DbPath) }
$backendUrl = 'http://127.0.0.1:3789'
$frontendUrl = 'http://127.0.0.1:5173'
$roles = [ordered]@{
    backend = @{ port = 3789; dir = Join-Path $source '06_backend'; script = 'start'; dependency = 'tsx' }
    frontend = @{ port = 5173; dir = Join-Path $source '05_web_app'; script = 'dev'; dependency = 'vite' }
}

function Write-State {
    $json = @{ worktree = $source; head = $head; services = @($owned.Values) } | ConvertTo-Json -Depth 4
    $temp = "$statePath.new"
    [IO.File]::WriteAllText($temp, $json)
    if ([IO.File]::Exists($statePath)) { [IO.File]::Replace($temp, $statePath, "$statePath.previous") }
    else { [IO.File]::Move($temp, $statePath) }
}

function Get-OwnedRoot($record) {
    $process = Get-Process -Id $record.id -ErrorAction SilentlyContinue
    if (!$process -or $process.StartTime.ToUniversalTime().Ticks.ToString() -ne $record.born) { return }
    $identity = Get-CimInstance Win32_Process -Filter ("ProcessId=" + $record.id)
    $command = [string]$identity.CommandLine
    $guid = [Guid]::Empty
    if (!$roles.Contains($record.role) -or ![Guid]::TryParseExact($record.nonce, 'N', [ref]$guid) -or
        $identity.Name -ne 'node.exe' -or !$command.Contains("--title=holobeat-$($record.nonce)") -or
        $command.IndexOf($roles[$record.role].dir, [StringComparison]::OrdinalIgnoreCase) -lt 0) {
        throw "Cannot verify saved process $($record.id) belongs to this launcher. No action taken."
    }
    return $process
}

function Test-ProcessTree([int]$child, [int]$root) {
    for ($depth = 0; $child -gt 0 -and $depth -lt 16; $depth++) {
        if ($child -eq $root) { return $true }
        $entryProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$child"
        if (!$entryProcess) { return $false }
        $child = [int]$entryProcess.ParentProcessId
    }
    return $false
}

function Test-Ports([string]$require = '') {
    $listeners = @(Get-NetTCPConnection -State Listen)
    foreach ($role in $roles.Keys) {
        $port = $roles[$role].port
        $matching = @($listeners | Where-Object { $_.LocalPort -eq $port })
        if ($role -eq $require -and !$matching.Count) { return $false }
        foreach ($listener in $matching) {
            $rootProcess = $null
            if ($owned.ContainsKey($role)) { $rootProcess = Get-OwnedRoot $owned[$role] }
            if (!$rootProcess -or !(Test-ProcessTree $listener.OwningProcess $rootProcess.Id)) {
                throw "Port $port is occupied by an unmanaged process (PID $($listener.OwningProcess)). Close it yourself or use its existing launcher. No process on this port was stopped."
            }
            if ($listener.LocalAddress -ne '127.0.0.1') { throw "Unexpected bind address on port $port." }
        }
    }
    return $true
}

function Test-LockedDependencies($spec) {
    if (!(Test-Path -LiteralPath (Join-Path $spec.dir "node_modules\.bin\$($spec.dependency).cmd"))) { return $false }
    # npm's installed lock omits the root and optional binaries for other OS/CPU targets.
    $verifyLock = @'
const fs = require('node:fs');
const root = process.argv[1];
try {
    const lock = JSON.parse(fs.readFileSync(root + '/package-lock.json')).packages;
    const installed = JSON.parse(fs.readFileSync(root + '/node_modules/.package-lock.json')).packages;
    const missing = Object.keys(lock).some(k => k && !lock[k].optional && !installed[k]);
    const changed = Object.keys(installed).some(k => !lock[k] ||
        ['version','integrity','resolved'].some(field => lock[k][field] !== installed[k][field]));
    process.exitCode = missing || changed ? 1 : 0;
} catch { process.exitCode = 1; }
'@
    & $node -e $verifyLock $spec.dir
    return $LASTEXITCODE -eq 0
}

function Stop-Owned([string]$role) {
    if (!$owned.ContainsKey($role)) { return }
    $record = $owned[$role]
    $rootProcess = Get-OwnedRoot $record
    if ($rootProcess) {
        Write-Host "Stopping managed $role PID $($record.id)"
        & taskkill.exe /PID $record.id /T /F | Out-Null
        if ($LASTEXITCODE -ne 0 -and (Get-OwnedRoot $record)) { throw "Could not stop managed $role." }
        if (!$rootProcess.WaitForExit(8000)) { throw "$role has not stopped." }
    }
    $owned.Remove($role)
    Write-State
}

function Start-Owned([string]$role) {
    $spec = $roles[$role]
    $nonce = [Guid]::NewGuid().ToString('N')
    $arguments = "--title=holobeat-$nonce ""$npmCli"" --prefix ""$($spec.dir)"" run $($spec.script)"
    if ($role -eq 'frontend') { $arguments += ' -- --host 127.0.0.1 --strictPort' }
    $process = Start-Process -FilePath $node -ArgumentList $arguments -WorkingDirectory $spec.dir -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $cache "$role.log") -RedirectStandardError (Join-Path $cache "$role.err.log")
    $owned[$role] = @{ role = $role; id = $process.Id; born = $process.StartTime.ToUniversalTime().Ticks.ToString(); nonce = $nonce }
    Write-State
}

function Wait-Ready([string]$role, [string]$url) {
    $deadline = [DateTime]::UtcNow.AddSeconds(45)
    do {
        if (!(Get-Process -Id $owned[$role].id -ErrorAction SilentlyContinue)) {
            throw "$role exited. See $cache\$role.err.log"
        }
        try { $response = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 -Uri $url }
        catch { $response = $null }
        if ($response -and $response.StatusCode -eq 200 -and (Test-Ports $role)) { return $response }
        Start-Sleep -Milliseconds 200
    } while ([DateTime]::UtcNow -lt $deadline)
    throw "$role did not become ready. See $cache\$role.err.log"
}

[IO.Directory]::CreateDirectory($cache) | Out-Null
try { $gate = [IO.File]::Open((Join-Path $cache 'launcher.lock'), 'OpenOrCreate', 'ReadWrite', 'None') }
catch { throw "Another launcher is active or the lock cannot be opened in $cache." }
try {
    $owned = @{}
    if (Test-Path -LiteralPath $statePath) {
        $saved = Get-Content -Raw -LiteralPath $statePath | ConvertFrom-Json
        if ($saved.worktree -ne $source) { throw "The launch state belongs to another worktree." }
        foreach ($record in $saved.services) { $owned[$record.role] = $record }
    }
    [void](Test-Ports)
    if ($Stop) {
        Stop-Owned 'frontend'
        Stop-Owned 'backend'
        Write-Host 'Managed services stopped.'
        return
    }
    $node = (Get-Command node.exe).Source
    $npm = (Get-Command npm.cmd).Source
    $npmCli = Join-Path (Split-Path -Parent $npm) 'node_modules\npm\bin\npm-cli.js'
    if (!(Test-Path -LiteralPath $npmCli)) { throw "npm-cli.js is missing alongside $npm." }
    Write-Host "Archive: $archive"
    Write-Host "Logs:    $cache"
    if ($CheckOnly) { Write-Host 'Source, branch ancestry and port ownership checks passed.'; return }

    Stop-Owned 'frontend'
    Stop-Owned 'backend'
    foreach ($role in $roles.Keys) {
        $spec = $roles[$role]
        if (!(Test-LockedDependencies $spec)) {
            Write-Host "Installing locked $role dependencies."
            & $npm --prefix $spec.dir ci --no-audit --no-fund
            if ($LASTEXITCODE -ne 0) { throw "Dependency installation failed for $role." }
        }
    }
    if (!$DbPath -and !(Test-Path -LiteralPath (Split-Path -Parent $archive))) {
        $prepare = [Uri]::new((Join-Path $source '06_backend\src\archiveDirectory.ts')).AbsoluteUri
        & $node --experimental-strip-types --input-type=module --eval 'const {prepareDefaultDirectory}=await import(process.argv[1]); prepareDefaultDirectory(process.argv[2])' $prepare (Split-Path -Parent $archive)
        if ($LASTEXITCODE -ne 0) { throw 'Could not create the protected archive directory.' }
    }
    $env:HOST = '127.0.0.1'
    $env:PORT = '3789'
    $env:HOLOBEAT_DB_PATH = $archive
    $env:VITE_HOLOBEAT_API_URL = $backendUrl
    try {
        Start-Owned 'backend'
        $health = (Wait-Ready 'backend' "$backendUrl/health").Content | ConvertFrom-Json
        if ($health.ok -ne $true -or $health.service -ne 'holobeat-archive-backend') { throw 'Unexpected backend /health response.' }
        Write-Host 'Backend /health OK'
        try { $generateStatus = (Invoke-WebRequest -UseBasicParsing -TimeoutSec 4 "$backendUrl/generate").StatusCode }
        catch { $generateStatus = [int]$_.Exception.Response.StatusCode }
        if ($generateStatus -ne 404) { throw "Expected GET /generate to return HTTP 404; received $generateStatus." }
        Write-Host 'Backend /generate 404 (expected for this archive API)'
        Start-Owned 'frontend'
        $index = Wait-Ready 'frontend' "$frontendUrl/"
        if ($index.Content -notmatch '/@vite/client' -or $index.Content -notmatch '/src/main.tsx') { throw 'Response is not the source Vite development app.' }
        $main = Invoke-WebRequest -UseBasicParsing -TimeoutSec 20 "$frontendUrl/src/main.tsx"
        if ($main.StatusCode -ne 200 -or $main.Content -notmatch 'createRoot') { throw 'Could not load the React source entry.' }
        Write-Host "HoloBeat is ready at $frontendUrl/"
    } catch {
        Stop-Owned 'frontend'
        Stop-Owned 'backend'
        throw
    }
    if (!$NoBrowser) { Start-Process "$frontendUrl/" }
} finally {
    $gate.Dispose()
}
