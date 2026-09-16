#requires -Version 7.0
[CmdletBinding()]
param([switch]$Apply, [switch]$TestInteractive, [switch]$UseEnvironmentKey, [switch]$ValidateAuth)
$ErrorActionPreference = 'Stop'
$projectRef = 'jnzlultjyrtrkziqeocy'
$baseUrl = "https://$projectRef.supabase.co"
$repo = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$targets = @(
    @{ Email = 'admin@lacarpinteria.demo'; Name = 'Admin La Carpintería'; Workshop = 'La Carpintería' },
    @{ Email = 'johan@lacarpinteria.demo'; Name = 'Johan'; Workshop = 'La Carpintería' },
    @{ Email = 'maestro.demo@lacarpinteria.demo'; Name = 'Maestro Demo'; Workshop = 'Taller Demo' }
)
function Read-PrivateValue([string]$Prompt) {
    $secure = Read-Host $Prompt -AsSecureString
    try { return [System.Net.NetworkCredential]::new('', $secure).Password }
    finally { $secure.Dispose() }
}
function Read-AccountPasswords {
    foreach ($target in $targets) {
        $password = Read-PrivateValue "Contraseña para $($target.Email) (mínimo 12 caracteres)"
        if ($password.Length -lt 12) { throw "Contraseña demasiado corta para $($target.Email)." }
        $passwords[$target.Email] = $password
        $password = $null
    }
    Write-Host 'Tres contraseñas recibidas en memoria. Las cuentas existentes conservarán su contraseña.'
}
function Invoke-AuthAdmin([string]$Method, [string]$Path, $Body = $null) {
    $parameters = @{ Uri = "$baseUrl/auth/v1/admin/$Path"; Method = $Method; Headers = $headers; TimeoutSec = 30; UserAgent = 'LaCarpinteria-Bootstrap/1.0'; MaximumRedirection = 0; Verbose = $false; Debug = $false }
    if ($null -ne $Body) { $parameters.ContentType = 'application/json'; $parameters.Body = ($Body | ConvertTo-Json -Compress) }
    try { return Invoke-RestMethod @parameters }
    catch {
        # Do not echo HTTP bodies, headers, exception dumps or credentials.
        $status = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 'red/timeout' }
        if ($status -eq 401) { throw 'Auth Admin rechazó la credencial (HTTP 401). Verifica que esté activa y pertenezca a LA-CARPINTERIA-PILOTO. No se reintentará ni se mostrarán datos de la clave.' }
        throw "Auth Admin falló (HTTP $status). No se revierte ni elimina ningún usuario. Corrige la causa y vuelve a ejecutar."
    }
}
Write-Host "Proyecto fijo: LA-CARPINTERIA-PILOTO ($projectRef)"
$targets | ForEach-Object { Write-Host "$($_.Email) -> $($_.Workshop) [admin]" }
if (-not $Apply -and -not $TestInteractive -and -not $ValidateAuth) {
    Write-Host 'Vista previa local. Para ejecutar: pwsh -File supabase/bootstrap/bootstrap.ps1 -Apply'
    return
}
if (([int]$Apply.IsPresent + [int]$TestInteractive.IsPresent + [int]$ValidateAuth.IsPresent) -gt 1) { throw 'Usa solo un modo: -Apply, -TestInteractive o -ValidateAuth.' }
Push-Location $repo
$key = $null; $headers = $null; $password = $null
$passwords = @{}
try {
    Write-Host ('Modo: ' + $(if ($TestInteractive) { 'PRUEBA INTERACTIVA LOCAL; sin red ni escrituras' } elseif ($ValidateAuth) { 'VALIDAR AUTH; solo lectura' } else { 'APLICAR' }))
    # Interactive by default; environment credentials require an explicit option.
    if ($UseEnvironmentKey) {
        $key = $env:SUPABASE_BOOTSTRAP_ADMIN_KEY
        if ([string]::IsNullOrWhiteSpace($key)) { throw 'No existe SUPABASE_BOOTSTRAP_ADMIN_KEY. Omite -UseEnvironmentKey para ingresar la clave.' }
        Write-Host 'Clave tomada de la variable de entorno por solicitud explícita.'
    } else {
        $key = Read-PrivateValue 'Clave administrativa Supabase (entrada oculta)'
    }
    Remove-Item Env:SUPABASE_BOOTSTRAP_ADMIN_KEY -ErrorAction SilentlyContinue
    if ($key -notmatch '^(sb_secret_|eyJ)') { throw 'Se requiere sb_secret o service_role; la clave publicable no sirve.' }
    $key = $key.Trim()
    # Secret keys are opaque API keys, never JWT Bearer credentials.
    $headers = @{ apikey = $key }
    if ($key.StartsWith('eyJ')) { $headers.Authorization = "Bearer $key" }
    if ($TestInteractive) {
        Read-AccountPasswords
        Write-Host 'PRUEBA COMPLETADA: no se contactó Supabase ni se guardaron datos.'
        return
    }
    Write-Host 'Validando credencial con GET Auth Admin (solo lectura)...'
    $firstPage = Invoke-AuthAdmin GET 'users?page=1&per_page=100'
    if ($null -eq $firstPage -or $firstPage.PSObject.Properties.Name -notcontains 'users') {
        throw 'Auth Admin devolvió una respuesta inesperada; no se solicitarán contraseñas.'
    }
    Write-Host 'Auth Admin validado correctamente.'
    if ($ValidateAuth) {
        Write-Host 'VALIDACIÓN COMPLETADA: sin solicitar contraseñas ni modificar usuarios.'
        return
    }
    Write-Host 'Verificando enlace local y migraciones mediante Supabase CLI...'
    $linkedFile = Join-Path $repo 'supabase/.temp/project-ref'
    if (-not (Test-Path $linkedFile) -or (Get-Content $linkedFile -Raw).Trim() -ne $projectRef) {
        throw "Enlaza primero este repositorio a $projectRef mediante Supabase CLI."
    }
    $historyRaw = & npx --yes supabase@2.117.0 db query --linked 'select version from supabase_migrations.schema_migrations order by version;' --output json
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo verificar el proyecto mediante CLI. No se crearon usuarios.' }
    try { $migrationResponse = ($historyRaw -join "`n") | ConvertFrom-Json -ErrorAction Stop }
    catch { throw 'La CLI no devolvió JSON válido. No se crearon usuarios.' }
    # CLI releases can return the row array directly or wrap it in rows.
    if ($null -ne $migrationResponse -and $migrationResponse.PSObject.Properties.Name -contains 'rows') {
        $migrationRows = @($migrationResponse.rows)
    } elseif ($migrationResponse -is [array] -or ($null -ne $migrationResponse -and $migrationResponse.PSObject.Properties.Name -contains 'version')) {
        $migrationRows = @($migrationResponse)
    } else {
        throw 'Formato de historial CLI no reconocido; no se puede concluir que falten migraciones. No se crearon usuarios.'
    }
    $appliedVersions = @()
    foreach ($migrationRow in $migrationRows) {
        if ($null -eq $migrationRow -or $migrationRow.PSObject.Properties.Name -notcontains 'version') {
            throw 'Fila del historial sin campo version. No se crearon usuarios.'
        }
        $appliedVersions += ([string]$migrationRow.version).Trim().Trim([char]96)
    }
    Write-Host ('Migraciones remotas detectadas: ' + ($appliedVersions -join ', '))
    foreach ($requiredVersion in @('001','002','003')) {
        if ($requiredVersion -notin $appliedVersions) { throw "Falta la migración $requiredVersion en el historial remoto verificado; no se crearon usuarios." }
    }
    Write-Host 'Migraciones verificadas. Revisando usuarios existentes...'
    $users = @(); $page = 1
    do {
        $result = if ($page -eq 1) { $firstPage } else { Invoke-AuthAdmin GET "users?page=$page&per_page=100" }
        $batch = @($result.users); $users += $batch; $page++
    } while ($batch.Count -eq 100)
    Read-AccountPasswords
    foreach ($target in $targets) {
        $existing = @($users | Where-Object { $_.email -ieq $target.Email })
        if ($existing.Count -gt 1) { throw "Correo ambiguo: $($target.Email)" }
        if ($existing.Count -eq 1) {
            if (-not $existing[0].email_confirmed_at) { throw "Usuario existente sin confirmar: $($target.Email). No se alteró la cuenta." }
            Write-Host "Ya existe: $($target.Email); contraseña conservada."
            $passwords.Remove($target.Email)
            continue
        }
        $password = $passwords[$target.Email]
        try {
            $created = Invoke-AuthAdmin POST 'users' @{
                email = $target.Email; password = $password; email_confirm = $true
                user_metadata = @{ full_name = $target.Name }
            }
            if (-not $created.id) { throw 'Auth no devolvió un identificador; verifica la cuenta antes de repetir.' }
            Write-Host "Usuario Auth creado: $($target.Email)"
        } finally { $password = $null; $passwords.Remove($target.Email) }
    }
    $key = $null; $headers = $null
    & npx --yes supabase@2.117.0 db query --linked --file supabase/bootstrap/provision.sql
    if ($LASTEXITCODE -ne 0) { throw 'Falló el aprovisionamiento SQL. Sus cambios se revierten; las cuentas Auth quedan disponibles para reintentar.' }
    Write-Host 'Bootstrap completado. Verifica arriba tres membresías admin en dos talleres.'
} catch {
    Write-Host ('BOOTSTRAP DETENIDO: ' + $_.Exception.Message) -ForegroundColor Red
    throw
} finally {
    $passwords.Clear()
    $key = $null; $headers = $null; $password = $null
    Remove-Item Env:SUPABASE_BOOTSTRAP_ADMIN_KEY -ErrorAction SilentlyContinue
    Pop-Location
}
