# SOLO LOCAL / TEST PROJECT. This runner never accepts a project-ref or --linked.
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$source = Join-Path $PSScriptRoot 'instagram_isolation.sql'
$config = Get-Content -LiteralPath (Join-Path $repoRoot 'supabase\config.toml') -Raw
$projectId = [regex]::Match($config, '(?m)^project_id\s*=\s*"([A-Za-z0-9_-]+)"\s*$').Groups[1].Value
if (-not $projectId) { throw 'No se pudo determinar el project_id local de Supabase.' }
$container = "supabase_db_$projectId"
Push-Location $repoRoot
try {
    $status = & npx supabase status --output json 2>&1
    if ($LASTEXITCODE -ne 0) { throw 'Supabase local no está iniciado. Inícialo antes de ejecutar esta prueba.' }
    $running = & docker inspect --format '{{.State.Running}}' $container 2>&1
    if ($LASTEXITCODE -ne 0 -or $running -ne 'true') { throw "No está operativo el contenedor local $container." }
    $sql = "set taller.instagram_local_test = 'enabled';`n" + (Get-Content -LiteralPath $source -Raw)
    $sql | & docker exec -i $container psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres
    if ($LASTEXITCODE -ne 0) { throw 'Falló la prueba local de aislamiento Instagram.' }
}
finally { Pop-Location }
