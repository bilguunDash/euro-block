# diagnose-login.ps1 - read-only login diagnostics for the Euroblock server (PC-2).
#
# Run on the server as Administrator (Windows PowerShell 5.1):
#   powershell -ExecutionPolicy Bypass -File .\diagnose-login.ps1
#   powershell -ExecutionPolicy Bypass -File .\diagnose-login.ps1 -TestEmail someone@mak.mn
#
# With -TestEmail it also performs a real sign-in exactly like the browser does and asks for that
# user's password (hidden, never printed or saved).
#
# What it checks: service + NSSM settings, effective configuration (.env.local vs service env),
# ports and IIS, auth endpoints, a real credentials sign-in, users table problems, and server logs.
# It changes nothing: no service restart, no file edits, database access is read-only.
# Secrets (passwords, NEXTAUTH_SECRET, DB password) are never printed.
# Messages are ASCII. Names and log lines in Cyrillic show as '?' on the server console;
# the saved report (UTF-8, C:\Deploy\login-diag-*.txt) shows them correctly.

param(
    [string]$AppDir = '',
    [int]$Port = 3010,
    [string]$PublicUrl = '',
    [string]$TestEmail = '',
    [string]$EnvFile = '',
    [string]$ReportDir = '',
    [int]$LogLines = 4000,
    [string]$ServiceName = 'EuroblockApp'
)

$ErrorActionPreference = 'Continue'
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}

$script:Lines = New-Object System.Collections.Generic.List[string]
$script:Findings = New-Object System.Collections.Generic.List[object]

function Out-Line([string]$Text = '', [string]$Color = 'Gray') {
    Write-Host $Text -ForegroundColor $Color
    [void]$script:Lines.Add($Text)
}
function Section([string]$Title) {
    Out-Line ''
    Out-Line ('=' * 72) 'Cyan'
    Out-Line "  $Title" 'Cyan'
    Out-Line ('=' * 72) 'Cyan'
}
function Pass([string]$Area, [string]$Message) { Out-Line "[ OK ] ${Area}: $Message" 'Green' }
function Info([string]$Area, [string]$Message) { Out-Line "[INFO] ${Area}: $Message" 'Gray' }
function Add-Finding([string]$Level, [string]$Area, [string]$Message, [string]$Hint = '') {
    $color = 'Yellow'
    if ($Level -eq 'FAIL') { $color = 'Red' }
    Out-Line "[$Level] ${Area}: $Message" $color
    if ($Hint) { Out-Line "       -> $Hint" $color }
    [void]$script:Findings.Add([pscustomobject]@{ Level = $Level; Area = $Area; Message = $Message; Hint = $Hint })
}
function Fail([string]$Area, [string]$Message, [string]$Hint = '') { Add-Finding 'FAIL' $Area $Message $Hint }
function Warn([string]$Area, [string]$Message, [string]$Hint = '') { Add-Finding 'WARN' $Area $Message $Hint }

# Single-line snippet without control characters. Cyrillic is kept: the console shows it as '?',
# the saved UTF-8 report shows it correctly.
function Snip([string]$Text, [int]$Max = 200) {
    if ($null -eq $Text) { return '' }
    $t = ($Text -replace '[\r\n\t]+', ' ') -replace '[\x00-\x1F\x7F]', ''
    if ($t.Length -gt $Max) { $t = $t.Substring(0, $Max) + '...' }
    return $t
}

function Read-EnvFile([string]$Path) {
    $vars = @{}
    if (-not $Path -or -not (Test-Path -LiteralPath $Path)) { return $vars }
    Get-Content -LiteralPath $Path -Encoding UTF8 | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith('#') -and $line -match '^([^=]+)=(.*)$') {
            $vars[$Matches[1].Trim()] = $Matches[2].Trim().Trim('"').Trim("'")
        }
    }
    return $vars
}

function Get-Sha([string]$Text) {
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $bytes = $sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes([string]$Text))
        return ([BitConverter]::ToString($bytes) -replace '-', '').Substring(0, 12).ToLower()
    } finally { $sha.Dispose() }
}

function Test-Tcp([string]$TargetHost, [int]$TargetPort) {
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $iar = $client.BeginConnect($TargetHost, $TargetPort, $null, $null)
        if (-not $iar.AsyncWaitHandle.WaitOne(3000)) { return $false }
        $client.EndConnect($iar)
        return $true
    } catch { return $false } finally { $client.Close() }
}

# HTTP without auto-redirect, with an optional cookie jar (behaves like the browser for cookies).
function Invoke-Http {
    param(
        [string]$Method,
        [string]$Url,
        [System.Net.CookieContainer]$Jar = $null,
        [string]$Body = '',
        [string]$ContentType = 'application/x-www-form-urlencoded'
    )
    $r = [pscustomobject]@{ Ok = $false; Status = 0; Body = ''; Location = ''; SetCookie = ''; Cookies = @(); Error = '' }
    $resp = $null
    try {
        $req = [System.Net.HttpWebRequest]::Create($Url)
        $req.Method = $Method
        $req.AllowAutoRedirect = $false
        $req.Timeout = 20000
        $req.ReadWriteTimeout = 20000
        $req.UserAgent = 'Mozilla/5.0 (EuroblockLoginDiag)'
        $req.Accept = '*/*'
        if ($null -eq $Jar) { $Jar = New-Object System.Net.CookieContainer }
        $req.CookieContainer = $Jar
        if ($Body -ne '') {
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($Body)
            $req.ContentType = $ContentType
            $req.ContentLength = $bytes.Length
            $stream = $req.GetRequestStream()
            $stream.Write($bytes, 0, $bytes.Length)
            $stream.Close()
        }
        try {
            $resp = $req.GetResponse()
        } catch {
            $ex = $_.Exception
            while ($null -ne $ex -and -not ($ex -is [System.Net.WebException])) { $ex = $ex.InnerException }
            if ($null -ne $ex -and $null -ne $ex.Response) { $resp = $ex.Response } else { throw }
        }
        $r.Status = [int]$resp.StatusCode
        $r.Location = [string]$resp.Headers['Location']
        $r.SetCookie = [string]$resp.Headers['Set-Cookie']
        $list = @()
        foreach ($c in $resp.Cookies) { $list += [pscustomobject]@{ Name = $c.Name; Secure = $c.Secure } }
        $r.Cookies = $list
        $reader = New-Object System.IO.StreamReader($resp.GetResponseStream(), [System.Text.Encoding]::UTF8)
        $r.Body = $reader.ReadToEnd()
        $reader.Close()
        $r.Ok = $true
    } catch {
        $r.Error = $_.Exception.Message
    } finally {
        if ($null -ne $resp) { $resp.Close() }
    }
    return $r
}

# Cookie names from a raw Set-Cookie header, and whether any of them is Secure-only.
function Get-CookieInfo([pscustomobject]$Response) {
    $names = @()
    foreach ($c in $Response.Cookies) { $names += $c.Name }
    foreach ($m in [regex]::Matches([string]$Response.SetCookie, '(?:^|,)\s*([^=;,\s]+)=')) {
        if ($names -notcontains $m.Groups[1].Value) { $names += $m.Groups[1].Value }
    }
    $secure = $false
    if ([string]$Response.SetCookie -match '(?i);\s*secure') { $secure = $true }
    foreach ($c in $Response.Cookies) { if ($c.Secure) { $secure = $true } }
    foreach ($n in $names) { if ($n -like '__Secure-*' -or $n -like '__Host-*') { $secure = $true } }
    return [pscustomobject]@{ Names = $names; Secure = $secure }
}

$started = Get-Date
Out-Line "Euroblock login diagnostics - $($started.ToString('yyyy-MM-dd HH:mm:ss')) on $env:COMPUTERNAME" 'White'
Out-Line "Read-only. Secrets are never printed." 'White'

# ---------------------------------------------------------------------------------------------
Section '1. Service and process'
# ---------------------------------------------------------------------------------------------
$svcParamsPath = "HKLM:\SYSTEM\CurrentControlSet\Services\$ServiceName\Parameters"
$svcParams = $null
try { $svcParams = Get-ItemProperty -LiteralPath $svcParamsPath -ErrorAction Stop } catch {}
$svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue

if ($null -eq $svc) {
    Fail 'service' "Windows service '$ServiceName' not found" 'Install it with deploy-server.ps1, or pass -ServiceName.'
} else {
    $startType = ''
    try { $startType = (Get-CimInstance Win32_Service -Filter "Name='$ServiceName'").StartMode } catch {}
    if ($svc.Status -eq 'Running') { Pass 'service' "$ServiceName is Running (start mode: $startType)" }
    else { Fail 'service' "$ServiceName is $($svc.Status)" "Start-Service $ServiceName, then check logs\error.log if it stops again." }
}

if (-not $AppDir) {
    if ($null -ne $svcParams -and $svcParams.AppDirectory) { $AppDir = [string]$svcParams.AppDirectory } else { $AppDir = 'C:\Apps\EuroblockShift' }
}
Info 'app dir' $AppDir
if (-not (Test-Path -LiteralPath (Join-Path $AppDir 'server.js'))) {
    Fail 'app dir' "server.js not found in $AppDir" 'The deploy ZIP was not extracted here, or AppDirectory in NSSM points elsewhere.'
}

$nodeExe = ''
if ($null -ne $svcParams -and $svcParams.Application) { $nodeExe = [string]$svcParams.Application }
if (-not $nodeExe -or -not (Test-Path -LiteralPath $nodeExe)) {
    $cmd = Get-Command node -ErrorAction SilentlyContinue
    if ($null -ne $cmd) { $nodeExe = $cmd.Source }
}
if ($nodeExe) {
    $nodeVersion = (& $nodeExe --version) 2>$null
    Info 'node' "$nodeExe ($nodeVersion)"
} else {
    Fail 'node' 'node.exe not found' 'Install Node.js LTS or fix the NSSM Application path.'
}
if ($null -ne $svcParams) {
    Info 'nssm' "Application=$($svcParams.Application) AppParameters=$($svcParams.AppParameters)"
}

$buildIdFile = Join-Path $AppDir '.next\BUILD_ID'
if (Test-Path -LiteralPath $buildIdFile) {
    $buildId = (Get-Content -LiteralPath $buildIdFile -Raw).Trim()
    Info 'build' "BUILD_ID on disk = $buildId (written $((Get-Item -LiteralPath $buildIdFile).LastWriteTime.ToString('yyyy-MM-dd HH:mm')))"
} else {
    $buildId = ''
    Fail 'build' ".next\BUILD_ID missing in $AppDir" 'Re-extract the deploy ZIP.'
}

try {
    # The app process is whoever listens on the app port; also list every node running server.js.
    $portPids = @()
    try { $portPids = @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction Stop | Select-Object -ExpandProperty OwningProcess -Unique) } catch {}
    $procs = @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like '*server.js*' -or $portPids -contains $_.ProcessId })
    if ($procs.Count -eq 0) { Warn 'process' "no node.exe is running the app (nothing on port $Port, no server.js process)" 'The service is not actually running the app.' }
    foreach ($p in $procs) {
        $uptime = (Get-Date) - $p.CreationDate
        $role = 'server.js'
        if ($portPids -contains $p.ProcessId) { $role = "listens on $Port" }
        Info 'process' ("PID {0} ({1}), running for {2:N1} h: {3}" -f $p.ProcessId, $role, $uptime.TotalHours, (Snip $p.CommandLine 150))
    }
    if ($procs.Count -gt 1) { Warn 'process' "$($procs.Count) node app processes are running" 'Only one should run; an old one may still hold the port.' }
} catch { Info 'process' "could not list processes: $($_.Exception.Message)" }

try {
    $since = (Get-Date).AddDays(-2)
    $events = @(Get-WinEvent -FilterHashtable @{ LogName = 'System'; ProviderName = 'Service Control Manager'; StartTime = $since } -ErrorAction Stop |
        Where-Object { $_.Message -like "*$ServiceName*" -or $_.Message -like '*Euroblock*' } | Select-Object -First 8)
    if ($events.Count -eq 0) { Pass 'events' 'no service crash/stop events in the last 48 h' }
    foreach ($e in $events) { Info 'events' ("{0} id={1} {2}" -f $e.TimeCreated.ToString('MM-dd HH:mm'), $e.Id, (Snip $e.Message 140)) }
} catch { Info 'events' 'no Service Control Manager events found for the service in the last 48 h' }

$drive = Get-PSDrive -Name ($AppDir.Substring(0, 1)) -ErrorAction SilentlyContinue
if ($null -ne $drive -and $null -ne $drive.Free) {
    $freeGb = [math]::Round($drive.Free / 1GB, 1)
    if ($freeGb -lt 2) { Warn 'disk' "only $freeGb GB free on $($drive.Name):" 'Low disk space can break logging and the database.' }
    else { Pass 'disk' "$freeGb GB free on $($drive.Name):" }
}

# ---------------------------------------------------------------------------------------------
Section '2. Configuration (service environment vs .env.local)'
# ---------------------------------------------------------------------------------------------
if (-not $EnvFile) { $EnvFile = Join-Path $AppDir '.env.local' }
$fileEnv = Read-EnvFile $EnvFile
if ($fileEnv.Count -gt 0) { Info '.env.local' "$EnvFile ($($fileEnv.Count) keys)" }
else { Warn '.env.local' "not found or empty: $EnvFile" }

$svcEnv = @{}
if ($null -ne $svcParams -and $null -ne $svcParams.AppEnvironmentExtra) {
    foreach ($pair in @($svcParams.AppEnvironmentExtra)) {
        if ($pair -match '^([^=]+)=(.*)$') { $svcEnv[$Matches[1].Trim()] = $Matches[2] }
    }
    Info 'service env' "$($svcEnv.Count) keys in NSSM AppEnvironmentExtra: $((@($svcEnv.Keys) | Sort-Object) -join ', ')"
} else {
    Info 'service env' 'NSSM AppEnvironmentExtra is empty; the app reads .env.local'
}

# The service environment wins over .env.local (Next.js never overrides an existing variable).
$effective = @{}
foreach ($k in $fileEnv.Keys) { $effective[$k] = $fileEnv[$k] }
foreach ($k in $svcEnv.Keys) { $effective[$k] = $svcEnv[$k] }

foreach ($k in @('DATABASE_URL', 'NEXTAUTH_URL', 'NEXTAUTH_SECRET')) {
    $inSvc = $svcEnv.ContainsKey($k)
    $inFile = $fileEnv.ContainsKey($k)
    if ($inSvc -and $inFile) {
        if ((Get-Sha $svcEnv[$k]) -eq (Get-Sha $fileEnv[$k])) { Pass $k 'same value in service env and .env.local' }
        else { Warn $k 'service env and .env.local have DIFFERENT values (the service env is used)' 'If .env.local was edited, re-run deploy-server.ps1 so NSSM gets the new value, or fix NSSM.' }
    } elseif ($inSvc) { Info $k 'set in service env only' }
    elseif ($inFile) { Info $k 'set in .env.local only' }
}

# Public URL that people type in the browser.
$nextAuthUrl = ''
if ($effective.ContainsKey('NEXTAUTH_URL')) { $nextAuthUrl = [string]$effective['NEXTAUTH_URL'] }
if (-not $PublicUrl) {
    if ($nextAuthUrl -and $nextAuthUrl -notmatch '(?i)//(localhost|127\.)') { $PublicUrl = $nextAuthUrl } else { $PublicUrl = 'http://euroblock.mak.mn' }
}
$PublicUrl = $PublicUrl.TrimEnd('/')
Info 'public url' "$PublicUrl (pass -PublicUrl if users open a different address)"

if (-not $nextAuthUrl) {
    Warn 'NEXTAUTH_URL' 'not set' "Set NEXTAUTH_URL=$PublicUrl so sign-in redirects and cookies use the right address."
} else {
    Info 'NEXTAUTH_URL' $nextAuthUrl
    $naUri = $null
    try { $naUri = [Uri]$nextAuthUrl } catch {}
    $pubUri = [Uri]$PublicUrl
    if ($null -eq $naUri) {
        Fail 'NEXTAUTH_URL' 'is not a valid URL' "Use the exact address users open, e.g. $PublicUrl"
    } else {
        if ($naUri.Scheme -eq 'https' -and $pubUri.Scheme -eq 'http') {
            Fail 'NEXTAUTH_URL' 'starts with https:// but the site is opened over http://' 'NextAuth then sets Secure-only cookies that the browser drops on http: sign-in succeeds but the user is sent back to the login page. Use http:// (or serve the site over https).'
        }
        if ($naUri.Host -match '^(localhost|127\.)' -and $pubUri.Host -notmatch '^(localhost|127\.)') {
            Warn 'NEXTAUTH_URL' "points to $($naUri.Host)" "After sign-in the browser is redirected to $($naUri.Host), which fails on other PCs. Use $PublicUrl."
        } elseif ($naUri.Host -ne $pubUri.Host) {
            Warn 'NEXTAUTH_URL' "host $($naUri.Host) differs from the public host $($pubUri.Host)" 'Users who open the other address are redirected or lose the session.'
        } elseif ($naUri.Scheme -eq $pubUri.Scheme) {
            Pass 'NEXTAUTH_URL' 'matches the public URL'
        }
    }
}

$secret = ''
if ($effective.ContainsKey('NEXTAUTH_SECRET')) { $secret = [string]$effective['NEXTAUTH_SECRET'] }
if (-not $secret) {
    Fail 'NEXTAUTH_SECRET' 'not set' 'Without it NextAuth refuses to work in production (error=Configuration). Set a long random value.'
} elseif ($secret.Length -lt 32) {
    Warn 'NEXTAUTH_SECRET' "set, but short ($($secret.Length) chars)" 'Use at least 32 random characters.'
} elseif ($secret -match '(?i)change|replace|your[-_]?secret|placeholder|example') {
    Warn 'NEXTAUTH_SECRET' 'looks like a placeholder value' 'Replace it with a long random value.'
} else {
    Pass 'NEXTAUTH_SECRET' "set ($($secret.Length) chars, value hidden)"
}

$dbUrl = ''
if ($effective.ContainsKey('DATABASE_URL')) { $dbUrl = [string]$effective['DATABASE_URL'] }
$dbHost = ''; $dbPort = 5432
if (-not $dbUrl) {
    Fail 'DATABASE_URL' 'not set' 'The app cannot read users without it.'
} elseif ($dbUrl -match '^postgres(?:ql)?://([^:@/]*)(?::[^@]*)?@([^/:?]+)(?::(\d+))?/([^?]*)') {
    $dbHost = $Matches[2]
    if ($Matches[3]) { $dbPort = [int]$Matches[3] }
    Info 'DATABASE_URL' "user=$($Matches[1]) host=${dbHost}:$dbPort db=$($Matches[4]) (password hidden)"
    if (Test-Tcp $dbHost $dbPort) { Pass 'database tcp' "${dbHost}:$dbPort is reachable" }
    else { Fail 'database tcp' "${dbHost}:$dbPort is NOT reachable" 'Start PostgreSQL / check the firewall; every sign-in fails while the DB is down.' }
} else {
    Warn 'DATABASE_URL' 'could not be parsed (value hidden)'
}

# ---------------------------------------------------------------------------------------------
Section '3. Ports and IIS'
# ---------------------------------------------------------------------------------------------
foreach ($p in @($Port, 80, 443, 3001)) {
    $listen = $null
    try { $listen = @(Get-NetTCPConnection -State Listen -LocalPort $p -ErrorAction Stop) } catch { $listen = @() }
    if ($listen.Count -gt 0) {
        $owners = @($listen | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object {
            $proc = Get-Process -Id $_ -ErrorAction SilentlyContinue
            if ($null -ne $proc) { "$($proc.ProcessName)($_)" } else { "pid $_" }
        })
        Info "port $p" "listening: $($owners -join ', ')"
    } elseif ($p -eq $Port) {
        Fail "port $p" 'nothing is listening on the app port' 'The app is not running or uses another PORT.'
    } else {
        Info "port $p" 'not listening'
    }
}

$w3 = Get-Service -Name W3SVC -ErrorAction SilentlyContinue
if ($null -eq $w3) {
    Info 'iis' 'IIS (W3SVC) is not installed'
} else {
    if ($w3.Status -eq 'Running') { Pass 'iis' 'W3SVC is Running' } else { Warn 'iis' "W3SVC is $($w3.Status)" 'If users reach the app through IIS, start it.' }
    try {
        Import-Module WebAdministration -ErrorAction Stop
        foreach ($site in @(Get-Website)) {
            $bindings = @($site.bindings.Collection | ForEach-Object { "$($_.protocol) $($_.bindingInformation)" }) -join '; '
            Info 'iis site' "$($site.Name) [$($site.State)] $bindings"
            $physical = [Environment]::ExpandEnvironmentVariables([string]$site.physicalPath)
            $webConfig = Join-Path $physical 'web.config'
            if (Test-Path -LiteralPath $webConfig) {
                $rules = @(Select-String -LiteralPath $webConfig -Pattern 'url="|localhost|127\.0\.0\.1|:3010' -ErrorAction SilentlyContinue | Select-Object -First 6)
                foreach ($r in $rules) { Info 'iis rule' (Snip $r.Line.Trim() 160) }
            }
        }
        try {
            $proxy = Get-WebConfigurationProperty -PSPath 'MACHINE/WEBROOT/APPHOST' -Filter 'system.webServer/proxy' -Name 'enabled' -ErrorAction Stop
            Info 'iis arr' "reverse proxy enabled = $($proxy.Value)"
        } catch { Info 'iis arr' 'ARR proxy setting not found (ARR may not be installed)' }
    } catch { Info 'iis' 'WebAdministration module not available; skipped site details' }
}

# ---------------------------------------------------------------------------------------------
Section '4. Auth endpoints'
# ---------------------------------------------------------------------------------------------
$localBase = "http://127.0.0.1:$Port"
$bases = @($localBase)
if ($PublicUrl -and $PublicUrl -ne $localBase) { $bases += $PublicUrl }

foreach ($base in $bases) {
    $label = 'local'
    if ($base -ne $localBase) { $label = 'public' }

    $r = Invoke-Http 'GET' "$base/auth/signin"
    if (-not $r.Ok) {
        if ($label -eq 'public') { Warn "$label signin" "$base unreachable from this server: $($r.Error)" 'Normal if the server cannot resolve its own public name; test the public URL from a user PC instead.' }
        else { Fail "$label signin" "$base unreachable: $($r.Error)" 'The app is not answering on this port.' }
        continue
    }
    if ($r.Status -eq 200) { Pass "$label signin" "GET /auth/signin -> 200" } else { Fail "$label signin" "GET /auth/signin -> $($r.Status)" (Snip $r.Body) }
    if ($label -eq 'local' -and $buildId) {
        if ($r.Body.Contains($buildId)) { Pass 'running build' 'the running app serves the BUILD_ID that is on disk' }
        else { Warn 'running build' 'the running app does NOT serve the BUILD_ID on disk' "Restart-Service $ServiceName so the new files are used." }
    }

    $r = Invoke-Http 'GET' "$base/api/auth/providers"
    if ($r.Status -eq 200 -and $r.Body -match '"credentials"') { Pass "$label providers" 'credentials provider is configured' }
    else { Fail "$label providers" "GET /api/auth/providers -> $($r.Status) $($r.Error)" (Snip $r.Body) }

    $r = Invoke-Http 'GET' "$base/api/auth/csrf"
    if ($r.Status -eq 200 -and $r.Body -match '"csrfToken"') { Pass "$label csrf" 'csrf token issued' }
    elseif ($r.Body -match '(?i)problem with the server configuration') { Fail "$label csrf" 'NextAuth reports a server configuration problem' 'Usually NEXTAUTH_SECRET is missing in the service environment.' }
    else { Fail "$label csrf" "GET /api/auth/csrf -> $($r.Status) $($r.Error)" (Snip $r.Body) }

    $r = Invoke-Http 'GET' "$base/api/auth/session"
    if ($r.Status -eq 200) { Pass "$label session" 'GET /api/auth/session -> 200' } else { Fail "$label session" "GET /api/auth/session -> $($r.Status) $($r.Error)" (Snip $r.Body) }

    $r = Invoke-Http 'GET' "$base/api/health/db"
    if ($r.Status -eq 200 -and $r.Body -match '"connected"\s*:\s*true') { Pass "$label db health" 'the app can query the database' }
    else { Fail "$label db health" "GET /api/health/db -> $($r.Status) $($r.Error)" 'The app cannot reach PostgreSQL; check logs\error.log and DATABASE_URL.' }
}

# ---------------------------------------------------------------------------------------------
Section '5. Real sign-in test'
# ---------------------------------------------------------------------------------------------
$plainPassword = ''
if (-not $TestEmail) {
    Info 'sign-in' 'skipped (run again with -TestEmail <email of a user who cannot log in>)'
} else {
    $plainPassword = [string]$env:EUROBLOCK_DIAG_PASSWORD
    if (-not $plainPassword) {
        $secure = Read-Host -AsSecureString "Password for $TestEmail (hidden, not saved)"
        $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
        try { $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
    }
    $email = $TestEmail.Trim()

    foreach ($base in $bases) {
        $label = 'local'
        if ($base -ne $localBase) { $label = 'public' }
        $jar = New-Object System.Net.CookieContainer
        $baseIsHttp = $base.StartsWith('http://')

        $r1 = Invoke-Http 'GET' "$base/api/auth/csrf" $jar
        if (-not $r1.Ok -or $r1.Status -ne 200) { Warn "$label sign-in" "cannot start: csrf -> $($r1.Status) $($r1.Error)"; continue }
        $csrf = ''
        try { $csrf = [string](ConvertFrom-Json $r1.Body).csrfToken } catch {}
        $csrfCookie = Get-CookieInfo $r1
        Info "$label sign-in" "csrf cookies: $($csrfCookie.Names -join ', ')"
        if ($csrfCookie.Secure -and $baseIsHttp) {
            Fail "$label sign-in" 'the server sets Secure-only cookies on an http:// site' 'The browser drops them, so sign-in can never complete. NEXTAUTH_URL must start with http:// while the site is served over http.'
        }

        $form = 'email=' + [Uri]::EscapeDataString($email) +
            '&password=' + [Uri]::EscapeDataString($plainPassword) +
            '&csrfToken=' + [Uri]::EscapeDataString($csrf) +
            '&callbackUrl=' + [Uri]::EscapeDataString("$base/") +
            '&redirect=false&json=true'
        $r2 = Invoke-Http 'POST' "$base/api/auth/callback/credentials" $jar $form
        $form = $null
        $resultUrl = ''
        try { $resultUrl = [string](ConvertFrom-Json $r2.Body).url } catch {}
        if (-not $resultUrl) { $resultUrl = $r2.Location }
        $errorCode = ''
        if ($resultUrl -match '[?&]error=([^&]+)') { $errorCode = [Uri]::UnescapeDataString($Matches[1]) }

        if (-not $r2.Ok) {
            Fail "$label sign-in" "POST credentials failed: $($r2.Error)"
        } elseif ($resultUrl -match '[?&]csrf=true') {
            Fail "$label sign-in" 'rejected: CSRF check failed' 'The csrf cookie did not come back: Secure cookies on http, or a proxy that strips cookies.'
        } elseif ($errorCode -eq 'CredentialsSignin') {
            Fail "$label sign-in" 'rejected: CredentialsSignin (user not found by this email, or wrong password)' 'See section 6: if the user exists with this exact email and has a valid hash, the password is wrong - reset it.'
        } elseif ($errorCode -eq 'ACCOUNT_NOT_APPROVED') {
            Fail "$label sign-in" 'rejected: ACCOUNT_NOT_APPROVED' 'An admin must approve this user (Admin > users).'
        } elseif ($errorCode -eq 'PASSWORD_NOT_SET') {
            Fail "$label sign-in" 'rejected: PASSWORD_NOT_SET' 'This user has no password; an admin must set one.'
        } elseif ($errorCode) {
            Fail "$label sign-in" "rejected: error=$errorCode" 'Configuration = NEXTAUTH_SECRET/NEXTAUTH_URL problem; other codes: see logs\error.log.'
        } elseif ($r2.Status -ne 200) {
            Fail "$label sign-in" "unexpected response $($r2.Status)" (Snip $r2.Body)
        } else {
            $sessionCookie = Get-CookieInfo $r2
            Pass "$label sign-in" "credentials accepted; cookies: $($sessionCookie.Names -join ', ')"
            if ($sessionCookie.Secure -and $baseIsHttp) {
                Fail "$label sign-in" 'the session cookie is Secure-only on an http:// site' 'The browser will not keep the session: the user lands on the login page again. Fix NEXTAUTH_URL to http://.'
            }
            try {
                $target = [Uri]$resultUrl
                $baseUri = [Uri]$base
                if ($target.Host -ne $baseUri.Host -or $target.Port -ne $baseUri.Port) {
                    $hint = 'Fix NEXTAUTH_URL to the public address.'
                    if ($label -eq 'local') { $hint = 'Expected for the local test when NEXTAUTH_URL is the public address.' }
                    Warn "$label sign-in" "after sign-in the browser is sent to $($target.Scheme)://$($target.Authority)" $hint
                }
            } catch {}
            $r3 = Invoke-Http 'GET' "$base/api/auth/session" $jar
            $sessionUser = $null
            try { $sessionUser = (ConvertFrom-Json $r3.Body).user } catch {}
            if ($null -ne $sessionUser -and $sessionUser.email) {
                Pass "$label sign-in" ("session works: role={0} approved={1} station={2}" -f $sessionUser.role, $sessionUser.isApproved, $sessionUser.stationCode)
                if ($sessionUser.role -eq 'operator' -or $sessionUser.role -eq 'master') {
                    Info "$label sign-in" ("device gate applies to this role: tablet/desktop allowed={0}, phone allowed={1}" -f $sessionUser.tabletAccessAllowed, $sessionUser.mobileAccessAllowed)
                    if ($sessionUser.tabletAccessAllowed -eq $false) { Warn 'device' 'tablet/desktop access is OFF for this user' 'After login the user sees "device not allowed" on a PC/tablet. Enable tabletAccessAllowed in Admin.' }
                    if ($sessionUser.mobileAccessAllowed -eq $false) { Info 'device' 'phone access is OFF for this user (blocked if they use a phone)' }
                }
            } else {
                Fail "$label sign-in" 'credentials accepted but the session is empty' 'The session cookie is not kept or cannot be decoded: Secure cookies on http, or NEXTAUTH_SECRET changed between requests.'
            }
        }
    }
}

# ---------------------------------------------------------------------------------------------
Section '6. Users table (read-only)'
# ---------------------------------------------------------------------------------------------
if (-not $dbUrl -or -not $nodeExe) {
    Info 'database' 'skipped (no DATABASE_URL or node.exe)'
} else {
    $nodeScript = @'
const path = require('path');
const { createRequire } = require('module');
const out = { ok: false };
(async () => {
  const req = createRequire(path.join(process.env.EUROBLOCK_DIAG_APP_DIR, 'package.json'));
  const { Client } = req('pg');
  const c = new Client({ connectionString: process.env.EUROBLOCK_DIAG_DB_URL, connectionTimeoutMillis: 8000 });
  await c.connect();
  try {
    await c.query('BEGIN READ ONLY');
    const q = async (sql, params) => (await c.query(sql, params)).rows;
    const BCRYPT = "'^[$]2[aby][$][0-9]{2}[$]'";
    out.server = (await q('SELECT version() AS v'))[0].v.split(',')[0];
    out.clockSkewSeconds = Math.round(((await q('SELECT extract(epoch FROM now()) AS t'))[0].t * 1000 - Date.now()) / 1000);
    out.totals = (await q(`SELECT COUNT(*)::int AS users,
        COUNT(*) FILTER (WHERE "isApproved" = false)::int AS not_approved,
        COUNT(*) FILTER (WHERE "passwordHash" IS NULL OR "passwordHash" = '')::int AS no_password,
        COUNT(*) FILTER (WHERE "passwordHash" <> '' AND "passwordHash" !~ ${BCRYPT})::int AS bad_hash,
        COUNT(*) FILTER (WHERE email IS NULL OR btrim(email) = '')::int AS no_email,
        COUNT(*) FILTER (WHERE email IS NOT NULL AND email <> lower(btrim(email)))::int AS email_not_normalized
      FROM users`))[0];
    out.notNormalized = await q(`SELECT name, email, role FROM users WHERE email IS NOT NULL AND email <> lower(btrim(email)) ORDER BY name LIMIT 25`);
    out.badHash = await q(`SELECT name, email, role FROM users WHERE "passwordHash" <> '' AND "passwordHash" !~ ${BCRYPT} ORDER BY name LIMIT 25`);
    out.duplicates = await q(`SELECT lower(btrim(email)) AS email, COUNT(*)::int AS n FROM users WHERE email IS NOT NULL AND btrim(email) <> '' GROUP BY 1 HAVING COUNT(*) > 1 ORDER BY 1 LIMIT 25`);
    const test = String(process.env.EUROBLOCK_DIAG_TEST_EMAIL || '').trim().toLowerCase();
    if (test) {
      out.testExact = await q(`SELECT id, name, email, role, "isApproved", "stationCode", "shiftGroup",
          "tabletAccessAllowed", "mobileAccessAllowed",
          ("passwordHash" IS NOT NULL AND "passwordHash" <> '') AS has_password,
          COALESCE("passwordHash" ~ ${BCRYPT}, false) AS bcrypt_hash, "updatedAt"
        FROM users WHERE email = $1`, [test]);
      out.testLoose = await q(`SELECT name, email FROM users WHERE lower(btrim(email)) = $1 AND email <> $1`, [test]);
      const ids = out.testExact.map((u) => u.id);
      out.testDevices = ids.length
        ? await q(`SELECT "deviceType", allowed, "blockedReason", platform, "ipAddress", "lastSeenAt" FROM user_devices WHERE "userId" = ANY($1) ORDER BY "lastSeenAt" DESC LIMIT 8`, [ids])
        : [];
    }
    await c.query('ROLLBACK');
    out.ok = true;
  } finally {
    await c.end();
  }
})().catch((e) => { out.error = `${e.code || ''} ${e.message}`.trim(); }).finally(() => {
  process.stdout.write(JSON.stringify(out).replace(/[\u007f-\uffff]/g, (ch) => '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0')));
});
'@
    $tmpScript = Join-Path $env:TEMP ('euroblock-login-diag-' + [guid]::NewGuid().ToString('N') + '.cjs')
    [IO.File]::WriteAllText($tmpScript, $nodeScript, (New-Object System.Text.UTF8Encoding($false)))
    $env:EUROBLOCK_DIAG_APP_DIR = $AppDir
    $env:EUROBLOCK_DIAG_DB_URL = $dbUrl
    $env:EUROBLOCK_DIAG_TEST_EMAIL = $TestEmail
    $raw = ''
    try { $raw = (& $nodeExe $tmpScript 2>&1 | Out-String) } finally {
        Remove-Item Env:EUROBLOCK_DIAG_DB_URL -ErrorAction SilentlyContinue
        Remove-Item Env:EUROBLOCK_DIAG_APP_DIR -ErrorAction SilentlyContinue
        Remove-Item Env:EUROBLOCK_DIAG_TEST_EMAIL -ErrorAction SilentlyContinue
        Remove-Item -LiteralPath $tmpScript -Force -ErrorAction SilentlyContinue
    }
    $db = $null
    try { $db = ConvertFrom-Json $raw } catch {}
    if ($null -eq $db) {
        Fail 'database' 'query failed' (Snip $raw 300)
    } elseif (-not $db.ok) {
        Fail 'database' "cannot read users: $(Snip $db.error 200)" 'Check DATABASE_URL (password) and that PostgreSQL is running; sign-in is impossible while this fails.'
    } else {
        Pass 'database' "connected: $($db.server)"
        if ([math]::Abs([int]$db.clockSkewSeconds) -gt 300) { Warn 'clock' "server and database clocks differ by $($db.clockSkewSeconds) s" 'Fix Windows time sync; large skew can expire sessions immediately.' }
        $t = $db.totals
        Info 'users' ("total={0} not_approved={1} no_password={2} bad_hash={3} no_email={4} email_not_lowercase={5}" -f $t.users, $t.not_approved, $t.no_password, $t.bad_hash, $t.no_email, $t.email_not_normalized)
        if ($t.email_not_normalized -gt 0) {
            Fail 'users' "$($t.email_not_normalized) user(s) have an email with capitals or spaces" 'Login lowercases the typed email, so these users can NEVER sign in until the email is saved in lowercase.'
            foreach ($u in $db.notNormalized) { Out-Line ("         {0} | '{1}' | {2}" -f $u.name, $u.email, $u.role) 'Red' }
        }
        if ($t.bad_hash -gt 0) {
            Fail 'users' "$($t.bad_hash) user(s) have a password that is not a bcrypt hash" 'These users can never sign in; reset their password from Admin.'
            foreach ($u in $db.badHash) { Out-Line ("         {0} | {1} | {2}" -f $u.name, $u.email, $u.role) 'Red' }
        }
        if (@($db.duplicates).Count -gt 0) {
            Warn 'users' "$(@($db.duplicates).Count) email(s) exist more than once (ignoring case)"
            foreach ($d in $db.duplicates) { Out-Line ("         {0} x{1}" -f $d.email, $d.n) 'Yellow' }
        }
        if ($t.no_password -gt 0) { Info 'users' "$($t.no_password) user(s) without a password get PASSWORD_NOT_SET" }
        if ($t.not_approved -gt 0) { Info 'users' "$($t.not_approved) user(s) waiting for approval get ACCOUNT_NOT_APPROVED" }

        if ($TestEmail) {
            $exact = @($db.testExact)
            if ($exact.Count -eq 0) {
                $loose = @($db.testLoose)
                if ($loose.Count -gt 0) {
                    Fail 'test user' "no user with email '$($TestEmail.Trim().ToLower())', but found it with different case/spaces: '$($loose[0].email)'" 'Save the email in lowercase without spaces; then the user can sign in.'
                } else {
                    Fail 'test user' "no user with email '$($TestEmail.Trim().ToLower())'" 'Typo in the email, or the account does not exist (check ERP sync / Admin).'
                }
            } else {
                $u = $exact[0]
                Info 'test user' ("name={0} role={1} station={2} crew={3} updated={4}" -f $u.name, $u.role, $u.stationCode, $u.shiftGroup, $u.updatedAt)
                if (-not $u.isApproved) { Fail 'test user' 'not approved' 'Approve the user in Admin.' } else { Pass 'test user' 'approved' }
                if (-not $u.has_password) { Fail 'test user' 'has no password' 'Set a password in Admin.' }
                elseif (-not $u.bcrypt_hash) { Fail 'test user' 'password is not a bcrypt hash' 'Reset the password in Admin.' }
                else { Pass 'test user' 'has a valid password hash (if sign-in still says CredentialsSignin, the typed password is wrong)' }
                if ($u.role -eq 'operator' -or $u.role -eq 'master') {
                    Info 'test user' ("device gate: tablet/desktop={0} phone={1}" -f $u.tabletAccessAllowed, $u.mobileAccessAllowed)
                    if (-not $u.tabletAccessAllowed) { Warn 'test user' 'tablet/desktop access is OFF' 'On a PC/tablet the user gets "device not allowed" right after login.' }
                }
                foreach ($d in @($db.testDevices)) {
                    $line = "device {0} allowed={1} reason={2} last={3} ip={4}" -f $d.deviceType, $d.allowed, $d.blockedReason, $d.lastSeenAt, $d.ipAddress
                    if ($d.allowed) { Info 'test user' $line } else { Warn 'test user' $line 'This device is blocked by the device-access rules.' }
                }
            }
        }
    }
}
$plainPassword = $null

# ---------------------------------------------------------------------------------------------
Section '7. Server logs'
# ---------------------------------------------------------------------------------------------
$logFiles = @()
if ($null -ne $svcParams) {
    foreach ($p in @($svcParams.AppStderr, $svcParams.AppStdout)) { if ($p -and (Test-Path -LiteralPath $p)) { $logFiles += [string]$p } }
}
if ($logFiles.Count -eq 0) {
    foreach ($n in @('error.log', 'app.log')) { $p = Join-Path $AppDir "logs\$n"; if (Test-Path -LiteralPath $p) { $logFiles += $p } }
}
$logDir = Join-Path $AppDir 'logs'
if (Test-Path -LiteralPath $logDir) {
    $recent = @(Get-ChildItem -LiteralPath $logDir -File | Sort-Object LastWriteTime -Descending | Select-Object -First 5)
    foreach ($f in $recent) { Info 'log file' ("{0} {1:N0} KB {2}" -f $f.Name, ($f.Length / 1KB), $f.LastWriteTime.ToString('yyyy-MM-dd HH:mm')) }
}
$pattern = '(?i)next-?auth|NO_SECRET|JWT_SESSION_ERROR|CLIENT_FETCH_ERROR|CredentialsSignin|ACCOUNT_NOT_APPROVED|PASSWORD_NOT_SET|\[auth\]|ECONNREFUSED|ETIMEDOUT|password authentication failed|PrismaClient|P1001|P2024|EADDRINUSE|Unhandled|FATAL|Error:'
foreach ($file in $logFiles) {
    $tail = @(Get-Content -LiteralPath $file -Tail $LogLines -Encoding UTF8 -ErrorAction SilentlyContinue)
    $hits = @($tail | Where-Object { $_ -match $pattern })
    Info 'log scan' "$file : $($hits.Count) matching line(s) in the last $($tail.Count)"
    foreach ($h in ($hits | Select-Object -Last 25)) { Out-Line ('         ' + (Snip $h 220)) 'DarkYellow' }
    if ($file -like '*error*') {
        Out-Line "  last 10 lines of $([IO.Path]::GetFileName($file)):" 'Gray'
        foreach ($l in ($tail | Select-Object -Last 10)) { Out-Line ('         ' + (Snip $l 220)) 'DarkGray' }
    }
}
if ($logFiles.Count -eq 0) { Warn 'logs' "no log files found (NSSM AppStdout/AppStderr or $logDir)" }

# ---------------------------------------------------------------------------------------------
Section 'Summary'
# ---------------------------------------------------------------------------------------------
$fails = @($script:Findings | Where-Object { $_.Level -eq 'FAIL' })
$warns = @($script:Findings | Where-Object { $_.Level -eq 'WARN' })
if ($fails.Count -eq 0 -and $warns.Count -eq 0) {
    Out-Line 'No problems found by the automatic checks.' 'Green'
    if (-not $TestEmail) { Out-Line 'Next step: run again with -TestEmail <email of a user who cannot log in>.' 'Green' }
} else {
    foreach ($f in $fails) { Out-Line "FAIL  $($f.Area): $($f.Message)" 'Red'; if ($f.Hint) { Out-Line "      -> $($f.Hint)" 'Red' } }
    foreach ($w in $warns) { Out-Line "WARN  $($w.Area): $($w.Message)" 'Yellow'; if ($w.Hint) { Out-Line "      -> $($w.Hint)" 'Yellow' } }
}

if (-not $ReportDir) {
    if (Test-Path -LiteralPath 'C:\Deploy') { $ReportDir = 'C:\Deploy' } else { $ReportDir = $env:TEMP }
}
$reportPath = Join-Path $ReportDir ('login-diag-' + $started.ToString('yyyyMMdd-HHmmss') + '.txt')
try {
    [IO.File]::WriteAllLines($reportPath, $script:Lines, (New-Object System.Text.UTF8Encoding($true)))
    Out-Line ''
    Out-Line "Report saved: $reportPath  ($($fails.Count) FAIL, $($warns.Count) WARN)" 'White'
} catch {
    Out-Line "Could not save the report to ${ReportDir}: $($_.Exception.Message)" 'Yellow'
}
