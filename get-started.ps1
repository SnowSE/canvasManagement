#Requires -Version 5.1
<#
.SYNOPSIS
  Sets up a new CanvasManager instance, step by step.

.DESCRIPTION
  Checks for (and offers to install) Docker and git, collects your GitHub and
  Canvas tokens, and sets up three git repos side by side in one folder:

    CanvasManagerConfig  docker-compose.yml, globalSettings.yml, restart.ps1
                         (and .env with your tokens, which is never committed)
    CanvasCourses        your courses, as markdown
    FacultyFiles         static files (images) your courses link to

  Each one can be an existing repo you clone, or a new private GitHub repo the
  script creates. Then it starts the container, opens it in your browser, and
  can start it again automatically after every reboot.

  Safe to run again: it finds your existing setup, offers your current answers
  as defaults and backs up any file it replaces.

  Windows:  powershell -ExecutionPolicy Bypass -File .\get-started.ps1
  Linux/macOS (PowerShell 7):  pwsh ./get-started.ps1
#>

$CanvasUrl = 'https://snow.instructure.com'
$Image = 'snowcollege/canvas_management:4'
$ContainerName = 'canvas-manager'
$DefaultPort = 3000
$GhScopes = @('admin:org', 'repo', 'workflow')
$GhTokenUrl = 'https://github.com/settings/tokens/new?scopes=admin:org,repo,workflow&description=canvasManager'
$GuideUrl = 'https://snowse.github.io/canvasManagement/getting-started.html'
# keys this script manages in .env; anything else already there is kept as is
$ManagedEnvKeys = @('CANVAS_TOKEN', 'GH_TOKEN', 'AI_BASE_URL', 'AI_API_KEY', 'AI_MODEL',
  'DOCKER_UID', 'DOCKER_GID', 'CANVAS_MANAGER_PORT', 'FILE_POLLING')

$onWindows = $env:OS -eq 'Windows_NT'
$onMac = (-not $onWindows) -and ((uname) -eq 'Darwin')
$onLinux = (-not $onWindows) -and (-not $onMac)
$onWsl = $onLinux -and (Test-Path /proc/version) -and ((Get-Content /proc/version -Raw) -match 'microsoft')

# web request progress bars clutter the prompts (and slow Windows PowerShell)
$ProgressPreference = 'SilentlyContinue'

# Windows PowerShell 5.1 defaults to TLS 1.0, which Canvas and GitHub refuse
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

# set once the GitHub token is known; used for the script's own clones and pushes
$script:GhToken = ''
# repos this script cloned or created over https, which get a credential helper
$script:TokenRepos = @()

# ---------------------------------------------------------------- helpers ---

# thrown to end the setup early with a message; caught at the bottom so a
# piped `irm ... | iex` run does not close the user's PowerShell window
function Stop-Setup([string]$Message) {
  throw (New-Object System.OperationCanceledException $Message)
}

$script:stepNumber = 0
function Write-Step([string]$Title) {
  $script:stepNumber++
  Write-Host ''
  Write-Host "== $($script:stepNumber). $Title " -ForegroundColor Cyan
}

function Write-Info([string]$Text) { Write-Host "  $Text" }
function Write-Good([string]$Text) { Write-Host "  OK  $Text" -ForegroundColor Green }
function Write-Warn([string]$Text) { Write-Host "  !   $Text" -ForegroundColor Yellow }

function Read-Answer([string]$Prompt, [string]$Default = '') {
  $suffix = if ($Default) { " [$Default]" } else { '' }
  $answer = Read-Host "  $Prompt$suffix"
  if ([string]::IsNullOrWhiteSpace($answer)) { return $Default }
  return $answer.Trim()
}

function Read-YesNo([string]$Prompt, [bool]$Default = $true) {
  $hint = if ($Default) { 'Y/n' } else { 'y/N' }
  while ($true) {
    $answer = Read-Host "  $Prompt [$hint]"
    if ([string]::IsNullOrWhiteSpace($answer)) { return $Default }
    if ($answer.Trim() -match '^(y|yes)$') { return $true }
    if ($answer.Trim() -match '^(n|no)$') { return $false }
    Write-Info 'Please answer y or n.'
  }
}

function Read-Secret([string]$Prompt) {
  $secure = Read-Host "  $Prompt" -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
  if ($null -eq $plain) { return '' }
  return $plain.Trim()
}

function Test-Command([string]$Name) {
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

# runs a native command, capturing stdout and stderr together
function Invoke-Native([scriptblock]$Command) {
  $output = & $Command 2>&1 | Out-String
  return [pscustomobject]@{ Ok = ($LASTEXITCODE -eq 0); Output = $output }
}

function Open-Url([string]$Url) {
  Write-Info "Opening $Url"
  try {
    if ($onWindows) { Start-Process $Url }
    elseif ($onMac) { open $Url }
    elseif ($onWsl -and (Test-Command 'explorer.exe')) { explorer.exe $Url }
    elseif (Test-Command 'xdg-open') { xdg-open $Url *> $null }
  } catch {
    Write-Info '(could not open a browser; open the link above yourself)'
  }
}

function Resolve-UserPath([string]$Path) {
  $trimmed = $Path.Trim().Trim('"').Trim("'")
  return $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($trimmed)
}

# LF line endings, UTF-8 without a BOM (a BOM breaks the first line of .env)
function Write-TextFile([string]$Path, [string]$Content) {
  $utf8 = New-Object System.Text.UTF8Encoding $false
  [IO.File]::WriteAllText($Path, ($Content -replace "`r`n", "`n"), $utf8)
}

function Backup-File([string]$Path) {
  if (Test-Path $Path -PathType Leaf) {
    Copy-Item $Path "$Path.bak" -Force
    Write-Info "Saved the old $(Split-Path $Path -Leaf) as $(Split-Path $Path -Leaf).bak"
  }
}

function Read-EnvFile([string]$Path) {
  $values = [ordered]@{}
  if ($Path -and (Test-Path $Path -PathType Leaf)) {
    foreach ($line in Get-Content $Path) {
      if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$') {
        $values[$Matches[1]] = $Matches[2].Trim().Trim('"').Trim("'")
      }
    }
  }
  return $values
}

function Get-Masked([string]$Secret) {
  if ($Secret.Length -le 4) { return '****' }
  return '...' + $Secret.Substring($Secret.Length - 4)
}

# a YAML single-quoted string; forward slashes so Windows paths read cleanly
function ConvertTo-YamlPath([string]$Path) {
  return "'" + ($Path -replace '\\', '/' -replace "'", "''") + "'"
}

function Test-PortFree([int]$Port) {
  try {
    $listener = New-Object System.Net.Sockets.TcpListener ([System.Net.IPAddress]::Any), $Port
    $listener.Start()
    $listener.Stop()
    return $true
  } catch {
    return $false
  }
}

function Get-DefaultTimeZone {
  try {
    $id = [TimeZoneInfo]::Local.Id
    if ($id -notmatch '/') {
      $iana = $null
      # .NET 6+ only, so PowerShell 7; Windows PowerShell falls to the catch
      if ([TimeZoneInfo]::TryConvertWindowsIdToIanaId($id, [ref]$iana)) { $id = $iana }
    }
    if ($id -match '/' -and $id -notmatch '^Etc/') { return $id }
  } catch {}
  return 'America/Denver'
}

function Update-PathFromRegistry {
  # winget installs land on PATH only for new shells; pick them up here
  if ($onWindows) {
    $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
      [Environment]::GetEnvironmentVariable('Path', 'User')
  }
}

function Get-HttpStatus($ErrorRecord) {
  if ($ErrorRecord.Exception.Response) { return [int]$ErrorRecord.Exception.Response.StatusCode }
  return 0
}

function Test-CanvasToken([string]$Token) {
  try {
    $me = Invoke-RestMethod -Uri "$CanvasUrl/api/v1/users/self" -TimeoutSec 20 -ErrorAction Stop `
      -Headers @{ Authorization = "Bearer $Token" }
    return [pscustomobject]@{ Ok = $true; Rejected = $false; Name = $me.name; Message = '' }
  } catch {
    return [pscustomobject]@{ Ok = $false; Rejected = ((Get-HttpStatus $_) -eq 401); Name = ''; Message = $_.Exception.Message }
  }
}

function Test-GitHubToken([string]$Token) {
  try {
    $response = Invoke-WebRequest -Uri 'https://api.github.com/user' -UseBasicParsing -TimeoutSec 20 -ErrorAction Stop `
      -Headers @{ Authorization = "token $Token"; 'User-Agent' = 'canvas-manager-setup' }
    $user = $response.Content | ConvertFrom-Json
    # classic tokens list their scopes in this header; fine-grained ones don't
    $scopeHeader = "$($response.Headers['X-OAuth-Scopes'])"
    $missing = @()
    if ($scopeHeader) {
      $scopes = $scopeHeader -split ',\s*'
      $missing = @($GhScopes | Where-Object { $scopes -notcontains $_ })
    }
    return [pscustomobject]@{
      Ok = $true; Rejected = $false; Message = ''
      Login = $user.login; Name = $user.name; Id = $user.id
      ScopesKnown = [bool]$scopeHeader; Missing = $missing
    }
  } catch {
    return [pscustomobject]@{
      Ok = $false; Rejected = ((Get-HttpStatus $_) -eq 401); Message = $_.Exception.Message
      Login = ''; Name = ''; Id = 0; ScopesKnown = $false; Missing = @()
    }
  }
}

function Invoke-GitHub([string]$Method, [string]$Path, $Body = $null) {
  $params = @{
    Method = $Method
    Uri = "https://api.github.com$Path"
    TimeoutSec = 30
    ErrorAction = 'Stop'
    Headers = @{
      Authorization = "token $($script:GhToken)"
      Accept = 'application/vnd.github+json'
      'User-Agent' = 'canvas-manager-setup'
    }
  }
  if ($null -ne $Body) {
    $params.Body = ($Body | ConvertTo-Json)
    $params.ContentType = 'application/json'
  }
  return Invoke-RestMethod @params
}

# the repo, or $null when it does not exist (or the token cannot see it)
function Get-GitHubRepo([string]$Owner, [string]$Name) {
  try { return Invoke-GitHub GET "/repos/$Owner/$Name" }
  catch { if ((Get-HttpStatus $_) -eq 404) { return $null } throw }
}

function New-GitHubRepo([string]$Owner, [string]$Login, [string]$Name, [string]$Description, [bool]$AutoInit) {
  $body = @{ name = $Name; private = $true; description = $Description; auto_init = $AutoInit }
  $path = if ($Owner -eq $Login) { '/user/repos' } else { "/orgs/$Owner/repos" }
  return Invoke-GitHub POST $path $body
}

# owner/name, or a URL; GitHub shorthand becomes an https URL
function ConvertTo-RepoUrl([string]$Answer) {
  if ($Answer -match '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$' -and -not (Test-Path $Answer)) {
    return "https://github.com/$($Answer -replace '\.git$', '').git"
  }
  return $Answer
}

function Get-RepoName([string]$Url) {
  $leaf = ($Url.TrimEnd('/', '\') -split '[/\\:]')[-1]
  return ($leaf -replace '\.git$', '')
}

function Test-GitHubHttps([string]$Url) {
  return $Url -match '^https://github\.com/'
}

# git with the GitHub token for github.com over https, for the clones and
# pushes the script itself makes (the token is passed per command, not saved)
function Invoke-GitAuth {
  $basic = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("x-access-token:$($script:GhToken)"))
  & git -c 'credential.helper=' -c "http.https://github.com/.extraHeader=Authorization: Basic $basic" @args
  return ($LASTEXITCODE -eq 0)
}

function Test-GitRepo([string]$Dir) {
  return (Test-Path (Join-Path $Dir '.git'))
}

function Get-GitRemote([string]$Dir) {
  $result = Invoke-Native { git -C $Dir remote get-url origin }
  if ($result.Ok) { return $result.Output.Trim() }
  return ''
}

# Lets git on this computer push and pull a GitHub https repo with GH_TOKEN
# from .env, so the token lives in one place and a new token in .env just works.
# Written into the repo's own .git/config; the empty helper line first switches
# off any helper set globally (like Git Credential Manager) for this repo.
function Set-RepoCredentialHelper([string]$RepoDir, [string]$EnvPath) {
  $configPath = Join-Path $RepoDir '.git/config'
  if ((Get-Content $configPath -Raw) -match 'canvas-manager-token') { return }
  # sh single quotes; in a git config value a backslash is written \\
  $envForSh = ($EnvPath -replace '\\', '/') -replace "'", "'\\''"
  $helper = "!f() { test `$1 = get || exit 0; echo username=x-access-token; echo password=`$(sed -n 's/^GH_TOKEN=//p' '$envForSh'); }; f"
  $block = "# canvas-manager-token: git on this computer uses GH_TOKEN from $EnvPath for GitHub`n" +
    "[credential `"https://github.com`"]`n`thelper =`n`thelper = `"$helper`"`n"
  $utf8 = New-Object System.Text.UTF8Encoding $false
  [IO.File]::AppendAllText($configPath, $block, $utf8)
}

# volume sources inside the compose file: relative when the folder sits next
# to the config folder, so the config repo works on any computer
function Get-ComposeSource([string]$Dir, [string]$ConfigDir) {
  if ((Split-Path $Dir -Parent) -eq (Split-Path $ConfigDir -Parent)) { return "'../$(Split-Path $Dir -Leaf)'" }
  return (ConvertTo-YamlPath $Dir)
}

# where an existing compose file mounts a container path from, resolved
function Get-ComposeMount([string]$ComposePath, [string]$Target) {
  if (-not (Test-Path $ComposePath)) { return '' }
  $text = Get-Content $ComposePath -Raw
  $escaped = [regex]::Escape($Target)
  $source = ''
  if ($text -match "source:\s*['`"]?([^'`"\r\n]+?)['`"]?\s*[\r\n]+\s*target:\s*$escaped\s") { $source = $Matches[1] }
  elseif ($text -match "-\s*['`"]?([^'`"\s]+?):$escaped(:[a-zA-Z,]+)?['`"]?\s") { $source = $Matches[1] }
  if (-not $source) { return '' }
  $configDir = Split-Path $ComposePath -Parent
  if ($source.StartsWith('~')) { $source = Resolve-UserPath $source }
  elseif (-not [IO.Path]::IsPathRooted($source)) { $source = Join-Path $configDir $source }
  return [IO.Path]::GetFullPath($source).TrimEnd('/', '\')
}

function Test-CanvasManagerCompose([string]$Dir) {
  $compose = Join-Path $Dir 'docker-compose.yml'
  return (Test-Path $compose) -and ((Get-Content $compose -Raw) -match 'canvas_management')
}

# ------------------------------------------------------------------ steps ---

function Assert-Docker {
  Write-Step 'Docker'
  Write-Info 'CanvasManager runs in a Docker container, so Docker comes first.'

  if (-not (Test-Command 'docker')) {
    Write-Warn 'Docker is not installed.'
    if ($onWindows) {
      if ((Test-Command 'winget') -and (Read-YesNo 'Install Docker Desktop now with winget?')) {
        winget install -e --id Docker.DockerDesktop --accept-package-agreements --accept-source-agreements
        Stop-Setup ("Docker Desktop is installed. Start it from the Start menu (it may ask you to restart " +
          "Windows or to install WSL; say yes), wait until it says the engine is running, then run this script again.")
      }
      Open-Url 'https://docs.docker.com/desktop/setup/install/windows-install/'
      Stop-Setup 'Install Docker Desktop, start it, then run this script again.'
    }
    if ($onMac) {
      if ((Test-Command 'brew') -and (Read-YesNo 'Install Docker Desktop now with Homebrew?')) {
        brew install --cask docker
        open -a Docker
        Stop-Setup 'Docker Desktop is installed and starting. Finish its first-run prompts, then run this script again.'
      }
      Open-Url 'https://docs.docker.com/desktop/setup/install/mac-install/'
      Stop-Setup 'Install Docker Desktop, start it, then run this script again.'
    }
    if ($onWsl) {
      Write-Info 'You are in WSL. The easiest route is Docker Desktop on Windows with'
      Write-Info 'Settings > Resources > WSL integration turned on for this distro.'
      Write-Info 'You can also install Docker Engine inside WSL itself.'
    }
    if (Read-YesNo "Install Docker Engine now with Docker's install script (uses sudo)?" (-not $onWsl)) {
      sh -c 'curl -fsSL https://get.docker.com | sudo sh'
      if ($LASTEXITCODE -ne 0) { Stop-Setup 'The Docker install script failed; see its output above.' }
      $me = whoami
      sudo usermod -aG docker $me
      Stop-Setup ("Docker is installed. Log out and back in (so '$me' joins the docker group and can run " +
        "docker without sudo), then run this script again.")
    }
    Open-Url 'https://docs.docker.com/engine/install/'
    Stop-Setup 'Install Docker, then run this script again.'
  }

  $info = Invoke-Native { docker info }
  if (-not $info.Ok) {
    if ($info.Output -match 'permission denied') {
      $me = whoami
      Stop-Setup ("Your account cannot talk to Docker. Run  sudo usermod -aG docker $me  then log out " +
        'and back in and run this script again.')
    }
    Write-Warn 'Docker is installed but not running.'
    if ($onWindows) {
      $desktop = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
      if (Test-Path $desktop) { Write-Info 'Starting Docker Desktop...'; Start-Process $desktop }
      else { Write-Info 'Start Docker Desktop from the Start menu.' }
    } elseif ($onMac) {
      Write-Info 'Starting Docker Desktop...'
      open -a Docker
    } elseif ($onWsl -and -not (Test-Command 'systemctl')) {
      Write-Info 'Start Docker Desktop on Windows (or the docker service in WSL).'
    } elseif (Read-YesNo 'Start the docker service now (uses sudo)?') {
      sudo systemctl enable --now docker
    }
    Write-Host -NoNewline '  Waiting for Docker'
    $deadline = (Get-Date).AddMinutes(3)
    while ((Get-Date) -lt $deadline) {
      Start-Sleep -Seconds 5
      Write-Host -NoNewline '.'
      $info = Invoke-Native { docker info }
      if ($info.Ok) { break }
    }
    Write-Host ''
    if (-not $info.Ok) { Stop-Setup 'Docker did not start within 3 minutes. Start it yourself, then run this script again.' }
  }
  Write-Good 'Docker is running.'

  if (-not (Invoke-Native { docker compose version }).Ok) {
    if ($onLinux) {
      Stop-Setup ('Docker Compose is missing. Install the compose plugin (Debian/Ubuntu: ' +
        'sudo apt-get install docker-compose-plugin), then run this script again.')
    }
    Stop-Setup 'Docker Compose is missing; update Docker Desktop, then run this script again.'
  }
  Write-Good 'Docker Compose is available.'
}

function Assert-Git {
  Write-Step 'git'
  Write-Info 'Your setup, your courses and your course files each live in a git repo,'
  Write-Info 'so they have history, are backed up on GitHub, and can move to another computer.'
  if (Test-Command 'git') {
    Write-Good "$(git --version)"
    return
  }
  Write-Warn 'git is not installed, and CanvasManager needs it.'
  if (-not (Read-YesNo 'Install git now?')) { Stop-Setup 'Install git, then run this script again.' }
  if ($onWindows -and (Test-Command 'winget')) {
    winget install -e --id Git.Git --accept-package-agreements --accept-source-agreements
    Update-PathFromRegistry
  } elseif ($onMac) {
    if (Test-Command 'brew') { brew install git } else { xcode-select --install }
  } elseif (Test-Command 'apt-get') {
    sudo apt-get update; sudo apt-get install -y git
  } elseif (Test-Command 'dnf') {
    sudo dnf install -y git
  } else {
    Open-Url 'https://git-scm.com/downloads'
  }
  if (-not (Test-Command 'git')) {
    Stop-Setup 'git is still not on PATH. Finish installing it (open a new terminal if it just installed), then run this script again.'
  }
  Write-Good "$(git --version)"
}

# finds an existing setup (from this or an earlier run) to start from
function Select-BaseFolder {
  Write-Step 'Where everything lives'
  Write-Info 'One folder holds your three repos side by side:'
  Write-Info '  CanvasManagerConfig  docker-compose.yml, globalSettings.yml, restart.ps1, .env'
  Write-Info '  CanvasCourses        your courses, as markdown'
  Write-Info '  FacultyFiles         static files (images) your courses link to'

  $here = (Get-Location).Path
  if (Test-CanvasManagerCompose $here) {
    Write-Info "This folder is a CanvasManager setup: $here"
    if (Read-YesNo 'Update this setup?') {
      return [pscustomobject]@{ Base = (Split-Path $here -Parent); ConfigDir = $here }
    }
  }

  $base = Resolve-UserPath (Read-Answer 'Folder' (Join-Path $HOME 'CanvasManager'))
  New-Item -ItemType Directory -Force -Path $base | Out-Null
  $configDir = ''
  foreach ($dir in Get-ChildItem $base -Directory -ErrorAction SilentlyContinue) {
    if (Test-CanvasManagerCompose $dir.FullName) {
      $configDir = $dir.FullName
      Write-Info "Found your existing setup in $configDir"
      break
    }
  }
  Write-Good $base
  return [pscustomobject]@{ Base = $base; ConfigDir = $configDir }
}

function Get-GitHubToken([string]$Existing) {
  Write-Step 'GitHub token'
  Write-Info 'CanvasManager uses a GitHub token to create and clone your repos, to commit,'
  Write-Info 'pull and push from inside the app, and for the Classroom 50 buttons.'

  if ($Existing) {
    $check = Test-GitHubToken $Existing
    if ($check.Ok -and ($check.Missing -notcontains 'repo')) {
      Write-Info "Your .env already has a GitHub token ($(Get-Masked $Existing)) for $($check.Login)."
      if (Read-YesNo 'Keep it?') { return [pscustomobject]@{ Token = $Existing; User = $check } }
    } elseif ($check.Ok) {
      Write-Warn 'The GitHub token already in .env is missing the repo scope.'
    } else {
      Write-Warn "The GitHub token already in .env does not work: $($check.Message)"
    }
  }

  Write-Info 'The link below makes a classic token with the scopes already checked:'
  Write-Info '  repo (your repos), admin:org and workflow (Classroom 50).'
  Write-Info 'Pick an expiration, click Generate token, and copy it. GitHub shows it only once.'
  if (Read-YesNo 'Open that page now?') { Open-Url $GhTokenUrl } else { Write-Info $GhTokenUrl }

  while ($true) {
    $token = Read-Secret 'Paste your GitHub token (it will not be shown)'
    if (-not $token) { Write-Warn 'The GitHub token is required.'; continue }
    $check = Test-GitHubToken $token
    if (-not $check.Ok) {
      if ($check.Rejected) { Write-Warn 'GitHub rejected that token. Copy it again or make a new one.' }
      else { Write-Warn "Could not reach GitHub to check the token: $($check.Message)" }
      continue
    }
    Write-Good "GitHub knows this token as $($check.Login)."
    if ($check.Missing -contains 'repo') {
      Write-Warn 'It is missing the repo scope, which CanvasManager needs. Make one with the link above.'
      continue
    }
    if ($check.Missing.Count -gt 0) {
      Write-Warn "It is missing $($check.Missing -join ', '), so the Classroom 50 buttons will not work."
      if (-not (Read-YesNo 'Use it anyway?' $false)) { continue }
    }
    if (-not $check.ScopesKnown) {
      Write-Warn 'This looks like a fine-grained token, whose permissions cannot be checked here.'
      Write-Warn 'It needs read and write access to Administration and Contents on your repos.'
    }
    return [pscustomobject]@{ Token = $token; User = $check }
  }
}

function Assert-GitIdentity($GitHubUser) {
  $name = (Invoke-Native { git config --global user.name }).Output.Trim()
  $email = (Invoke-Native { git config --global user.email }).Output.Trim()
  if ($name -and $email) {
    Write-Good "git commits as $name <$email>"
    return
  }
  Write-Info 'git needs a name and email for your commits.'
  $defaultName = if ($GitHubUser.Name) { $GitHubUser.Name } else { $GitHubUser.Login }
  if (-not $name) { $name = Read-Answer 'Name' $defaultName }
  if (-not $email) { $email = Read-Answer 'Email' "$($GitHubUser.Id)+$($GitHubUser.Login)@users.noreply.github.com" }
  git config --global user.name $name
  git config --global user.email $email
  Write-Good "git commits as $name <$email>"
}

function Select-RepoOwner([string]$Login) {
  $orgs = @()
  try { $orgs = @(Invoke-GitHub GET '/user/orgs' | ForEach-Object { $_.login }) } catch {}
  if ($orgs.Count -gt 0) { Write-Info "New repos can go under your account or one of: $($orgs -join ', ')" }
  return (Read-Answer 'GitHub account or organization for new repos' $Login)
}

# Sets up one of the three repos and returns its local folder. Uses the folder
# already there if it is a repo; otherwise clones an existing repo the user
# names, or creates a private one on GitHub.
function Initialize-Repo {
  param(
    [string]$Title, [string]$Purpose, [string]$Base, [string]$DefaultName,
    [string]$KnownDir, [string]$Owner, [string]$Login, [bool]$CommitLater = $false
  )
  Write-Host ''
  Write-Host "  $Title" -ForegroundColor White
  Write-Info $Purpose

  if ($KnownDir -and (Test-GitRepo $KnownDir)) {
    $remote = Get-GitRemote $KnownDir
    if ($remote) { Write-Good "$KnownDir (from $remote)" }
    else { Write-Good $KnownDir; Write-Warn 'It has no remote, so it is not backed up anywhere yet.' }
    return $KnownDir
  }

  # a folder of files that is not a repo yet: give it a new GitHub repo
  if ($KnownDir -and (Test-Path $KnownDir) -and (Get-ChildItem $KnownDir -Force | Select-Object -First 1)) {
    Write-Info "$KnownDir has files but is not a git repo yet."
    $name = Read-Answer 'Name for its new private GitHub repo' (Split-Path $KnownDir -Leaf)
    $repo = Get-GitHubRepo $Owner $name
    if ($repo -and $repo.size -gt 0) {
      Stop-Setup "$Owner/$name already exists and has commits. Pick another name, or move $KnownDir aside and clone it."
    }
    if (-not $repo) { $repo = New-GitHubRepo $Owner $Login $name $Purpose $false }
    $url = $repo.clone_url
    git -C $KnownDir init -q
    git -C $KnownDir symbolic-ref HEAD refs/heads/main
    git -C $KnownDir remote add origin $url
    $script:TokenRepos += $KnownDir
    if (-not $CommitLater) {
      git -C $KnownDir add -A
      git -C $KnownDir commit -q -m 'Initial commit'
      if (-not (Invoke-GitAuth -C $KnownDir push -u origin main)) { Stop-Setup "Could not push $KnownDir to $url." }
    }
    Write-Good "$KnownDir (now $url)"
    return $KnownDir
  }

  while ($true) {
    $answer = Read-Answer 'Existing repo to use (URL or owner/name), or Enter to create a new private one'
    if ($answer) {
      $url = ConvertTo-RepoUrl $answer
      $name = Get-RepoName $url
    } else {
      $name = Read-Answer 'Name for the new repo' $DefaultName
      $repo = Get-GitHubRepo $Owner $name
      if ($repo) {
        Write-Info "$Owner/$name already exists on GitHub."
        if (-not (Read-YesNo 'Use it?')) { continue }
      } else {
        try { $repo = New-GitHubRepo $Owner $Login $name $Purpose $true }
        catch {
          Write-Warn "GitHub would not create $Owner/$name`: $($_.Exception.Message)"
          continue
        }
        Write-Good "Created the private repo $($repo.html_url)"
      }
      $url = $repo.clone_url
    }

    $dir = Join-Path $Base $name
    if (Test-GitRepo $dir) {
      Write-Good "$dir is already a clone (from $(Get-GitRemote $dir))"
      return $dir
    }
    if ((Test-Path $dir) -and (Get-ChildItem $dir -Force | Select-Object -First 1)) {
      Write-Warn "$dir already has files in it. Move them aside, or pick another repo."
      continue
    }

    # a repo GitHub just made can take a moment before it can be cloned
    $cloned = $false
    foreach ($attempt in 1..3) {
      if (Invoke-GitAuth clone $url $dir) { $cloned = $true; break }
      Start-Sleep -Seconds 3
    }
    if (-not $cloned) {
      Write-Warn "Could not clone $url (see above). Check the address and that your token can see it."
      continue
    }
    # an empty repo clones onto git's default branch name; GitHub's is main
    if (-not (Invoke-Native { git -C $dir rev-parse --verify -q HEAD }).Ok) {
      git -C $dir symbolic-ref HEAD refs/heads/main
    }
    if (Test-GitHubHttps $url) { $script:TokenRepos += $dir }
    Write-Good "Cloned into $dir"
    return $dir
  }
}

function Get-CanvasToken([string]$Existing) {
  Write-Step 'Canvas token'
  Write-Info "CanvasManager reads and updates your courses on $CanvasUrl as you."

  if ($Existing) {
    $check = Test-CanvasToken $Existing
    if ($check.Ok) {
      Write-Info "Your .env already has a Canvas token ($(Get-Masked $Existing)) for $($check.Name)."
      if (Read-YesNo 'Keep it?') { return $Existing }
    } else {
      Write-Warn "The Canvas token already in .env does not work: $($check.Message)"
    }
  }

  Write-Info 'To make one:'
  Write-Info '  1. In Canvas open Account > Settings and scroll to Approved Integrations.'
  Write-Info '  2. Click + New Access Token, give it a purpose like "CanvasManager",'
  Write-Info '     leave the expiration empty (or pick a date) and click Generate Token.'
  Write-Info '  3. Copy the token. Canvas shows it only once.'
  if (Read-YesNo 'Open your Canvas settings page now?') { Open-Url "$CanvasUrl/profile/settings" }

  while ($true) {
    $token = Read-Secret 'Paste your Canvas token (it will not be shown)'
    if (-not $token) { Write-Warn 'The Canvas token is required.'; continue }
    $check = Test-CanvasToken $token
    if ($check.Ok) {
      Write-Good "Canvas knows this token as $($check.Name)."
      return $token
    }
    if ($check.Rejected) {
      Write-Warn 'Canvas rejected that token. Copy it again (the whole thing) or make a new one.'
      continue
    }
    Write-Warn "Could not reach Canvas to check the token: $($check.Message)"
    if (Read-YesNo 'Use it anyway?' $false) { return $token }
  }
}

function Select-Port([int]$Current) {
  Write-Step 'Port'
  $busy = -not (Test-PortFree $Current)
  Write-Info "CanvasManager will be at http://localhost:$Current."
  if ($busy) {
    Write-Warn "Something is already using port $Current. That is fine if it is an earlier"
    Write-Warn 'CanvasManager this setup replaces; otherwise pick another port.'
  }
  if (-not (Read-YesNo 'Use a custom port?' $false)) { return $Current }
  while ($true) {
    $answer = Read-Answer 'Port'
    if ($answer -notmatch '^\d+$' -or [int]$answer -lt 1024 -or [int]$answer -gt 65535) {
      Write-Warn 'Enter a number from 1024 to 65535.'
      continue
    }
    if (-not (Test-PortFree ([int]$answer))) {
      Write-Warn "Port $answer is in use."
      if (-not (Read-YesNo "Use port $answer anyway?" $false)) { continue }
    }
    Write-Good "http://localhost:$answer"
    return [int]$answer
  }
}

function Select-TimeZone {
  Write-Step 'Time zone'
  Write-Info 'Due times you write are read in this time zone (an IANA name like America/Denver).'
  while ($true) {
    $timeZone = Read-Answer 'Time zone' (Get-DefaultTimeZone)
    if ($timeZone -match '^([A-Za-z_]+(/[A-Za-z0-9_+\-]+)+|UTC)$') { return $timeZone }
    Write-Warn "'$timeZone' does not look like an IANA time zone name."
  }
}

function Get-AiSettings($Existing) {
  Write-Step 'AI explanations (optional)'
  Write-Info 'The error list can ask an AI model to explain an error. Any OpenAI-compatible'
  Write-Info 'chat completions endpoint works.'

  if ($Existing.AI_BASE_URL -and $Existing.AI_MODEL) {
    Write-Info "Your .env already uses $($Existing.AI_MODEL) at $($Existing.AI_BASE_URL)."
    if (Read-YesNo 'Keep it?') {
      return [pscustomobject]@{ BaseUrl = $Existing.AI_BASE_URL; ApiKey = $Existing.AI_API_KEY; Model = $Existing.AI_MODEL }
    }
  }

  Write-Info '  1. OpenAI'
  Write-Info '  2. OpenRouter'
  Write-Info '  3. Ollama running on this computer (no key)'
  Write-Info '  4. Another OpenAI-compatible endpoint'
  Write-Info '  5. Skip (the Explain button stays off)'
  $choice = Read-Answer 'Choice' '5'
  switch ($choice) {
    '1' {
      Open-Url 'https://platform.openai.com/api-keys'
      return [pscustomobject]@{
        BaseUrl = 'https://api.openai.com/v1'
        ApiKey = (Read-Secret 'Paste your OpenAI API key')
        Model = (Read-Answer 'Model' 'gpt-4o-mini')
      }
    }
    '2' {
      Open-Url 'https://openrouter.ai/keys'
      return [pscustomobject]@{
        BaseUrl = 'https://openrouter.ai/api/v1'
        ApiKey = (Read-Secret 'Paste your OpenRouter API key')
        Model = (Read-Answer 'Model' 'meta-llama/llama-3.1-70b-instruct')
      }
    }
    '3' {
      Write-Info 'The container reaches Ollama on this computer as host.docker.internal.'
      return [pscustomobject]@{
        BaseUrl = 'http://host.docker.internal:11434/v1'
        ApiKey = ''
        Model = (Read-Answer 'Model' 'llama3.1')
      }
    }
    '4' {
      return [pscustomobject]@{
        BaseUrl = (Read-Answer 'Base URL (ending in /v1)')
        ApiKey = (Read-Secret 'API key (Enter for none)')
        Model = (Read-Answer 'Model')
      }
    }
    default { return $null }
  }
}

function Write-SetupFiles($Config) {
  Write-Step 'Writing the setup files'
  $folder = $Config.ConfigDir

  # .env: everything specific to this computer, so the rest can be committed
  $envPath = Join-Path $folder '.env'
  $lines = @(
    "# Written by get-started.ps1 on $(Get-Date -Format 'yyyy-MM-dd'). Private to this",
    '# computer and never committed (see .gitignore): the tokens act as you.',
    '',
    '# Canvas: Account > Settings > Approved Integrations > New Access Token',
    "CANVAS_TOKEN=$($Config.CanvasToken)",
    '',
    '# GitHub: repos, git inside the app, and the Classroom 50 buttons',
    "GH_TOKEN=$($Config.GitHubToken)",
    '',
    '# "Explain with AI" on the error list (any OpenAI-compatible endpoint)'
  )
  if ($Config.Ai) {
    $lines += "AI_BASE_URL=$($Config.Ai.BaseUrl)"
    if ($Config.Ai.ApiKey) { $lines += "AI_API_KEY=$($Config.Ai.ApiKey)" }
    $lines += "AI_MODEL=$($Config.Ai.Model)"
  } else {
    $lines += '# AI_BASE_URL=https://api.openai.com/v1'
    $lines += '# AI_API_KEY=sk-...'
    $lines += '# AI_MODEL=gpt-4o-mini'
  }
  $lines += ''
  $lines += '# http://localhost:<port>'
  $lines += "CANVAS_MANAGER_PORT=$($Config.Port)"
  if ($Config.Polling) {
    $lines += ''
    $lines += '# file change events do not reach the container from a Windows drive'
    $lines += 'FILE_POLLING=true'
  }
  if ($Config.Uid) {
    $lines += ''
    $lines += '# the account that owns your course folder; the container runs as it'
    $lines += "DOCKER_UID=$($Config.Uid)"
    $lines += "DOCKER_GID=$($Config.Gid)"
  }
  $kept = @($Config.ExistingEnv.Keys | Where-Object { $ManagedEnvKeys -notcontains $_ })
  if ($kept.Count -gt 0) {
    $lines += ''
    $lines += '# kept from your previous .env'
    foreach ($key in $kept) { $lines += "$key=$($Config.ExistingEnv[$key])" }
  }
  Backup-File $envPath
  Write-TextFile $envPath (($lines -join "`n") + "`n")
  if (-not $onWindows) {
    chmod 600 $envPath
    if (Test-Path "$envPath.bak") { chmod 600 "$envPath.bak" }
  }
  Write-Good '.env'

  # .gitignore: keep the tokens and backups out of the config repo
  $ignorePath = Join-Path $folder '.gitignore'
  $ignore = if (Test-Path $ignorePath) { @(Get-Content $ignorePath) } else { @() }
  $missing = @('.env', '*.bak') | Where-Object { $ignore -notcontains $_ }
  if ($missing) {
    Write-TextFile $ignorePath ((($ignore + $missing) -join "`n") + "`n")
    Write-Good '.gitignore'
  }

  # docker-compose.yml
  if ($Config.WriteCompose) {
    $composePath = Join-Path $folder 'docker-compose.yml'
    $compose = @'
# Written by get-started.ps1. Run ./restart.ps1 after changing this file or .env.
# Settings for one computer (tokens, port, uid) are in .env, so this file can
# be committed and used anywhere.
services:
  canvas_manager:
    image: __IMAGE__
    # the account that owns your course folder on the host; see .env
    user: "${DOCKER_UID:-1000}:${DOCKER_GID:-1000}"
    container_name: __CONTAINER__
    restart: unless-stopped
    ports:
      # only this computer can open it; anyone who can reach it acts in Canvas
      # as you. To open it from other machines, set CANVAS_MANAGER_ADDRESS=0.0.0.0
      # in .env (a trusted network only), then run ./restart.ps1
      - "${CANVAS_MANAGER_ADDRESS:-127.0.0.1}:${CANVAS_MANAGER_PORT:-3000}:3000"
    env_file:
      - .env
    environment:
      # where the port above is published, so the app can warn while other
      # machines can open it
      - CANVAS_MANAGER_ADDRESS=${CANVAS_MANAGER_ADDRESS:-127.0.0.1}
      - CANVAS_MANAGER_PORT=${CANVAS_MANAGER_PORT:-3000}
      - storageDirectory=/app/storage
      - TZ=__TZ__
      - NEXT_PUBLIC_ENABLE_FILE_SYNC=true
    # lets the container reach services on this computer, like Ollama
    extra_hosts:
      - "host.docker.internal:host-gateway"
    volumes:
      - type: bind
        source: ./globalSettings.yml
        target: /app/globalSettings.yml
      - type: bind
        source: __COURSES__
        target: /app/storage
      - type: bind
        source: __FILES__
        target: /app/public/images/facultyFiles
'@
    $replacements = [ordered]@{
      '__IMAGE__' = $Image
      '__CONTAINER__' = $ContainerName
      '__TZ__' = $Config.TimeZone
      '__COURSES__' = (Get-ComposeSource $Config.CoursesDir $folder)
      '__FILES__' = (Get-ComposeSource $Config.FilesDir $folder)
    }
    foreach ($key in $replacements.Keys) { $compose = $compose.Replace($key, $replacements[$key]) }
    Backup-File $composePath
    Write-TextFile $composePath ($compose.TrimEnd() + "`n")
    Write-Good 'docker-compose.yml'
  }

  # globalSettings.yml: never replaced, the app keeps the course list in it
  $settingsPath = Join-Path $folder 'globalSettings.yml'
  if (Test-Path $settingsPath -PathType Container) {
    # docker makes an empty directory here when the file is missing at startup
    if (-not (Get-ChildItem $settingsPath -Force)) { Remove-Item $settingsPath }
    else { Stop-Setup "$settingsPath is a folder, not a file. Move it aside and run this script again." }
  }
  if (Test-Path $settingsPath) {
    Write-Good 'globalSettings.yml (kept as it was)'
  } else {
    Write-TextFile $settingsPath "courses: []`n"
    Write-Good 'globalSettings.yml'
  }

  # restart.ps1
  $restartPath = Join-Path $folder 'restart.ps1'
  $restart = @'
#!/usr/bin/env pwsh
# Pulls the newest CanvasManager image and recreates the container.
# Run it after changing .env or docker-compose.yml, or when the app says an
# update is available. It also runs after every reboot if you chose that.

# Docker Desktop can take a while to start after a reboot or login
Write-Host "Waiting for Docker..."
while ($true) {
    docker info *> $null
    if ($LASTEXITCODE -eq 0) { break }
    Write-Host "Docker not ready, retrying in 5s..."
    Start-Sleep -Seconds 5
}

# run compose from the folder this script is in, wherever it is called from
Set-Location $PSScriptRoot

docker compose down
docker compose pull
docker compose up -d --remove-orphans
'@
  if (-not (Test-Path $restartPath)) {
    Write-TextFile $restartPath $restart
    if (-not $onWindows) { chmod +x $restartPath }
    Write-Good 'restart.ps1'
  } else {
    Write-Good 'restart.ps1 (kept as it was)'
  }

  # git on this computer uses GH_TOKEN from .env for the repos set up here
  foreach ($repoDir in $script:TokenRepos) { Set-RepoCredentialHelper $repoDir $envPath }
}

function Save-ConfigRepo([string]$ConfigDir) {
  if (-not (Test-GitRepo $ConfigDir)) { return }
  git -C $ConfigDir add -A
  if ((Invoke-Native { git -C $ConfigDir diff --cached --quiet }).Ok) {
    Write-Good 'The config repo has nothing new to commit.'
    return
  }
  git -C $ConfigDir commit -q -m 'CanvasManager setup from get-started.ps1'
  if (-not (Get-GitRemote $ConfigDir)) {
    Write-Good 'Committed the setup files (no remote to push to).'
    return
  }
  if (Invoke-GitAuth -C $ConfigDir push -u origin HEAD) { Write-Good 'Committed and pushed the setup files.' }
  else { Write-Warn 'Committed the setup files, but the push failed (see above). Push it yourself later.' }
}

function Start-CanvasManager([string]$Folder, [int]$Port) {
  Write-Step 'Starting CanvasManager'

  # a container with this name from some other folder would block ours
  # (labels come back as k=v,k=v: a Go template with quotes in it would be
  # mangled by Windows PowerShell's argument passing)
  $found = (Invoke-Native { docker ps -a --filter "name=^$ContainerName`$" --format '{{.Labels}}' }).Output.Trim()
  $startedFrom = ''
  if ($found -match '(^|,)com\.docker\.compose\.project\.working_dir=([^,]*)') { $startedFrom = $Matches[2] }
  $sameFolder = $startedFrom -and ((Resolve-UserPath $startedFrom) -eq $Folder)
  if ($found -and -not $sameFolder) {
    $where = if ($startedFrom) { "started from $startedFrom" } else { 'not started by compose' }
    Write-Warn "A '$ContainerName' container already exists ($where)."
    if (-not (Read-YesNo 'Remove it so this setup can start its own? Your files are not touched.')) {
      Stop-Setup "Left it alone. Stop it with  docker rm -f $ContainerName  and run this script again."
    }
    docker rm -f $ContainerName | Out-Null
  }

  Push-Location $Folder
  try {
    docker compose pull
    if ($LASTEXITCODE -ne 0) { Stop-Setup 'Could not download the CanvasManager image; see the output above.' }
    docker compose up -d --remove-orphans --force-recreate
    if ($LASTEXITCODE -ne 0) { Stop-Setup 'docker compose up failed; see the output above.' }
  } finally {
    Pop-Location
  }

  $url = "http://localhost:$Port"
  Write-Host -NoNewline "  Waiting for $url"
  $up = $false
  $deadline = (Get-Date).AddMinutes(2)
  while ((Get-Date) -lt $deadline) {
    try {
      Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop | Out-Null
      $up = $true
      break
    } catch {
      # any HTTP response, even an error page, means the server is listening
      if ($_.Exception.Response) { $up = $true; break }
    }
    Write-Host -NoNewline '.'
    Start-Sleep -Seconds 3
  }
  Write-Host ''
  if (-not $up) {
    Write-Warn "$url did not answer within 2 minutes. The last lines of its log:"
    Push-Location $Folder
    try { docker compose logs --tail 40 } finally { Pop-Location }
    Stop-Setup 'Fix what the log shows, then run ./restart.ps1 (or this script) again.'
  }
  Write-Good "CanvasManager is running at $url"
  Open-Url $url
  return $url
}

# runs restart.ps1 at every boot or login; returns a line saying how to undo it
function Enable-Autostart([string]$ConfigDir) {
  Write-Step 'Start after a reboot'
  Write-Info 'restart.ps1 can run every time this computer starts, so CanvasManager comes'
  Write-Info 'back on its own with the newest version.'
  if (-not (Read-YesNo 'Start CanvasManager automatically after a reboot?')) { return '' }

  $restartPath = Join-Path $ConfigDir 'restart.ps1'
  $shellPath = (Get-Process -Id $PID).Path

  if ($onWindows) {
    # a shortcut in the Startup folder: runs at sign-in, needs no admin rights
    $shortcutPath = Join-Path ([Environment]::GetFolderPath('Startup')) 'CanvasManager.lnk'
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = $shellPath
    $shortcut.Arguments = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$restartPath`""
    $shortcut.WorkingDirectory = $ConfigDir
    $shortcut.WindowStyle = 7
    $shortcut.Save()
    Write-Good 'It will start each time you sign in to Windows.'
    Write-Info 'Docker Desktop has to start then too: Docker Desktop > Settings > General >'
    Write-Info '"Start Docker Desktop when you sign in" (on by default).'
    return "To stop starting at sign-in, delete $shortcutPath"
  }

  if ($onMac) {
    $agents = Join-Path $HOME 'Library/LaunchAgents'
    New-Item -ItemType Directory -Force -Path $agents | Out-Null
    $plistPath = Join-Path $agents 'edu.snow.canvasmanager.plist'
    $log = Join-Path $ConfigDir 'restart.log'
    $plist = @"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>edu.snow.canvasmanager</string>
  <key>ProgramArguments</key>
  <array>
    <string>$shellPath</string>
    <string>-NoProfile</string>
    <string>-File</string>
    <string>$([Security.SecurityElement]::Escape($restartPath))</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict><key>PATH</key><string>/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin</string></dict>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>$([Security.SecurityElement]::Escape($log))</string>
  <key>StandardErrorPath</key><string>$([Security.SecurityElement]::Escape($log))</string>
</dict>
</plist>
"@
    Write-TextFile $plistPath $plist
    Write-Good 'It will start each time you log in.'
    Write-Info 'Docker Desktop has to start then too: Docker Desktop > Settings > General >'
    Write-Info '"Start Docker Desktop when you sign in".'
    return "To stop starting at login, delete $plistPath"
  }

  # Linux: a systemd service that runs after docker at boot, or cron without systemd
  $me = whoami
  if (Test-Path /run/systemd/system) {
    $unit = @"
[Unit]
Description=CanvasManager: pull the newest image and start it
After=docker.service network-online.target
Wants=docker.service network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
User=$me
WorkingDirectory=$ConfigDir
ExecStart=$shellPath -NoProfile -File "$restartPath"

[Install]
WantedBy=multi-user.target
"@
    Write-Info 'This installs a systemd service, which needs sudo.'
    $unit | sudo tee /etc/systemd/system/canvas-manager.service | Out-Null
    sudo systemctl daemon-reload
    sudo systemctl enable canvas-manager.service docker.service 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
      Write-Good 'It will start each time this computer boots (canvas-manager.service).'
      if ($onWsl) { Write-Info 'In WSL, "boots" means when WSL starts, which is when you first open it.' }
      return 'To stop starting at boot: sudo systemctl disable canvas-manager.service'
    }
    Write-Warn 'Could not enable the service; see the output above.'
    return ''
  }
  if (Test-Command 'crontab') {
    $line = "@reboot `"$shellPath`" -NoProfile -File `"$restartPath`" >> `"$(Join-Path $ConfigDir 'restart.log')`" 2>&1"
    $current = @(Invoke-Native { crontab -l }).Output -split "`n" | Where-Object { $_ -and $_ -notmatch 'restart\.ps1' }
    (@($current) + $line) -join "`n" | crontab -
    Write-Good 'It will start each time this computer boots (crontab @reboot).'
    return 'To stop starting at boot, remove the restart.ps1 line with: crontab -e'
  }
  Write-Warn 'This computer has neither systemd nor cron; run restart.ps1 after a reboot yourself.'
  return ''
}

# ------------------------------------------------------------------- main ---

function Invoke-Setup {
  Write-Host ''
  Write-Host 'CanvasManager setup' -ForegroundColor Cyan
  Write-Host 'This walks you through installing and configuring CanvasManager. Press Enter'
  Write-Host 'to accept the [default] shown with a question. Ctrl+C stops at any time;'
  Write-Host 'running the script again picks up where you left off.'

  Assert-Docker
  Assert-Git
  $location = Select-BaseFolder
  $base = $location.Base
  $existingEnv = if ($location.ConfigDir) { Read-EnvFile (Join-Path $location.ConfigDir '.env') } else { [ordered]@{} }

  $gitHub = Get-GitHubToken $existingEnv.GH_TOKEN
  $script:GhToken = $gitHub.Token
  Assert-GitIdentity $gitHub.User

  Write-Step 'Your repos'
  Write-Info 'For each one, name an existing repo to clone, or press Enter and the script'
  Write-Info 'creates a private one on GitHub.'
  $owner = Select-RepoOwner $gitHub.User.Login
  $login = $gitHub.User.Login

  $configDir = Initialize-Repo -Title 'App config (CanvasManagerConfig)' `
    -Purpose 'CanvasManager setup: docker-compose.yml, globalSettings.yml and restart.ps1' `
    -Base $base -DefaultName 'CanvasManagerConfig' -KnownDir $location.ConfigDir `
    -Owner $owner -Login $login -CommitLater $true
  # a config repo cloned from another computer may bring its own .env-less setup
  if ($existingEnv.Count -eq 0) { $existingEnv = Read-EnvFile (Join-Path $configDir '.env') }

  $composePath = Join-Path $configDir 'docker-compose.yml'
  $coursesDir = Initialize-Repo -Title 'Course files (CanvasCourses)' `
    -Purpose 'CanvasManager courses: one folder per course, as markdown' `
    -Base $base -DefaultName 'CanvasCourses' -KnownDir (Get-ComposeMount $composePath '/app/storage') `
    -Owner $owner -Login $login
  $filesDir = Initialize-Repo -Title 'Faculty files (FacultyFiles)' `
    -Purpose 'Static files (images) linked from CanvasManager courses' `
    -Base $base -DefaultName 'FacultyFiles' -KnownDir (Get-ComposeMount $composePath '/app/public/images/facultyFiles') `
    -Owner $owner -Login $login
  Write-Info ''
  Write-Info "An image saved as $(Join-Path $filesDir '1405/diagram.png') is written in markdown as"
  Write-Info '  ![diagram](/images/facultyFiles/1405/diagram.png)'

  $writeCompose = $true
  $port = $DefaultPort
  if ($existingEnv.CANVAS_MANAGER_PORT -match '^\d+$') { $port = [int]$existingEnv.CANVAS_MANAGER_PORT }
  if (Test-Path $composePath) {
    Write-Host ''
    Write-Info 'The config repo already has a docker-compose.yml.'
    $writeCompose = Read-YesNo 'Replace it with a new one? (the old one is saved as docker-compose.yml.bak)' $false
    if (-not $writeCompose) {
      $text = Get-Content $composePath -Raw
      if ($text -notmatch 'CANVAS_MANAGER_PORT' -and $text -match '"?(\d+):3000') { $port = [int]$Matches[1] }
      if ((Get-ComposeMount $composePath '/app/storage') -ne $coursesDir -or
          (Get-ComposeMount $composePath '/app/public/images/facultyFiles') -ne $filesDir) {
        Write-Warn "That compose file does not mount $coursesDir and $filesDir."
        Write-Warn 'Check its volumes, or run this again and let it write a new one.'
      }
    }
  }

  $config = [ordered]@{
    ConfigDir = $configDir
    CoursesDir = $coursesDir
    FilesDir = $filesDir
    ExistingEnv = $existingEnv
    WriteCompose = $writeCompose
    GitHubToken = $gitHub.Token
    # Windows drives, seen from Docker Desktop or from WSL, send no change events
    Polling = $onWindows -or ($onWsl -and $coursesDir -match '^/mnt/[a-z]/')
    Uid = ''
    Gid = ''
  }
  if ($onLinux) {
    $config.Uid = (id -u)
    $config.Gid = (id -g)
  }

  $config.CanvasToken = Get-CanvasToken $existingEnv.CANVAS_TOKEN
  if ($writeCompose -or ((Get-Content $composePath -Raw) -match 'CANVAS_MANAGER_PORT')) {
    $config.Port = Select-Port $port
  } else {
    $config.Port = $port
  }
  if ($writeCompose) { $config.TimeZone = Select-TimeZone }
  $config.Ai = Get-AiSettings $existingEnv

  Write-SetupFiles $config
  Save-ConfigRepo $configDir
  $url = Start-CanvasManager $configDir $config.Port
  $undo = Enable-Autostart $configDir

  Write-Step 'Done'
  Write-Info "CanvasManager:  $url"
  Write-Info "App config:     $configDir"
  Write-Info "Course files:   $coursesDir"
  Write-Info "Faculty files:  $filesDir"
  Write-Host ''
  Write-Info 'Next:'
  Write-Info '  - On the home page, add a new course or import one from Canvas.'
  Write-Info "  - The illustrated guide: $GuideUrl"
  Write-Info '  - When the app says an update is available, or after you edit .env, run'
  Write-Info "      $(Join-Path $configDir 'restart.ps1')"
  Write-Info '  - Commit and push CanvasManagerConfig after adding courses: the course list'
  Write-Info '    is in its globalSettings.yml.'
  if ($undo) { Write-Info "  - $undo" }
}

try {
  Invoke-Setup
} catch [System.OperationCanceledException] {
  Write-Host ''
  Write-Host $_.Exception.Message -ForegroundColor Yellow
} catch {
  Write-Host ''
  Write-Host "Setup stopped: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host 'Fix the problem and run this script again; it picks up where you left off.' -ForegroundColor Red
}
