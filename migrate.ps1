# migrate.ps1 - run from the project root, WITHOUT "vercel env run":
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\migrate.ps1
#
# Runs "alembic upgrade head" against ONE database that you name explicitly.
# SECRET_KEY, PIN_PEPPER and the two bootstrap PINs are read from the local
# .env file by the backend, so they must match the values set in Vercel.
# Nothing secret is printed.

# 1. The local .env must exist and define the four secrets (names only are checked).
if (-not (Test-Path .\.env)) {
    Write-Host '.env not found in this folder. If you renamed it to .env.bak, rename it back first.'
    exit 1
}
$envText = Get-Content .\.env
$missing = $false
Write-Host 'Checking .env (values are not shown):'
foreach ($name in 'SECRET_KEY', 'PIN_PEPPER', 'SUPERADMIN_BOOTSTRAP_PIN', 'AGENT_BOOTSTRAP_PIN') {
    $found = $envText | Where-Object { $_ -match "^\s*$name\s*=\s*\S" }
    if ($found) { Write-Host "  $name : set" }
    else { Write-Host "  $name : MISSING or empty"; $missing = $true }
}
if ($missing) {
    Write-Host 'Add the missing values to .env and run this again. Nothing was changed.'
    exit 1
}

# 2. Name the target database explicitly.
$secure = Read-Host 'Paste the PRODUCTION Neon connection string (direct, not -pooler)' -AsSecureString
$env:DATABASE_URL = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
$env:ENVIRONMENT = 'production'

$hostName = ([uri]($env:DATABASE_URL -replace '^postgres(ql)?://', 'http://')).Host
Write-Host ""
Write-Host "Target host: $hostName"
if ($hostName -like '*-pooler*') {
    Write-Host 'This is the POOLED host. In Neon, open Connect and turn OFF "Connection pooling", then copy that string.'
    Write-Host 'Stopping. Nothing was changed.'
    exit 1
}

# 3. Show the current state, and stop if it cannot be read.
Write-Host ""
Write-Host "Current migration state of this database (blank means no migration has been recorded):"
.\.venv\Scripts\python.exe -m alembic current
if ($LASTEXITCODE -ne 0) {
    Write-Host 'alembic could not read the database. Stopping. Nothing was changed.'
    exit 1
}

# 4. Confirm, then migrate.
Write-Host ""
$answer = Read-Host 'Is that the production database? Type YES to run the migration'
if ($answer -ne 'YES') {
    Write-Host 'Cancelled. Nothing was changed.'
    exit 1
}

.\.venv\Scripts\python.exe -m alembic upgrade head
Write-Host ""
Write-Host "Exit code: $LASTEXITCODE (0 means success)"
