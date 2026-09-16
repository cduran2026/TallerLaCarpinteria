#requires -Version 7.0
# Offline orchestration tests: HTTP, CLI and secret input are mocked.
$ErrorActionPreference = 'Stop'
$scriptFile = Join-Path $PSScriptRoot '../../supabase/bootstrap/bootstrap.ps1'
function Assert($condition, $message) { if (-not $condition) { throw "FAIL: $message" } }
function npx {
    Assert ($global:bootstrapTest_gets -ge 1) 'Auth validated before CLI'
    $global:LASTEXITCODE = 0
    if ($args -contains '--file') {
        $global:bootstrapTest_sqlRuns++
        if ($global:bootstrapTest_failSql) { $global:LASTEXITCODE = 1 }
        return
    }
    if ($global:bootstrapTest_cliFailure) { $global:LASTEXITCODE=1; return }
    if ($global:bootstrapTest_badJson) { return 'not-json' }
    return '{"rows":[{"version":"001"},{"version":"002"},{"version":"003"}]}'
}
function Read-Host {
    param($Prompt, [switch]$AsSecureString)
    $global:bootstrapTest_prompts++
    Assert $AsSecureString 'all prompts hidden'
    if ($Prompt -like 'Clave administrativa*') { return ConvertTo-SecureString 'sb_secret_offline_test_only' -AsPlainText -Force }
    return ConvertTo-SecureString 'Offline-test-password-42' -AsPlainText -Force
}
function Invoke-RestMethod {
    param($Uri,$Method,$Headers,$TimeoutSec,$ContentType,$Body,$UserAgent,$MaximumRedirection,$Verbose,$Debug)
    Assert ($UserAgent -eq 'LaCarpinteria-Bootstrap/1.0') 'non-browser user agent'
    Assert ($MaximumRedirection -eq 0) 'no credential redirects'
    if ($Headers.apikey.StartsWith('sb_secret_')) { Assert (-not $Headers.ContainsKey('Authorization')) 'secret is apikey only' }
    else { Assert ($Headers.Authorization -eq "Bearer $($Headers.apikey)") 'legacy JWT compatibility' }
    if ($global:bootstrapTest_unauthorized) {
        $failure=[Exception]::new('Mock unauthorized')
        $failure | Add-Member -NotePropertyName Response -NotePropertyValue ([pscustomobject]@{StatusCode=401})
        throw $failure
    }
    if ($global:bootstrapTest_failHttp) { throw 'Mock request failure (do not print request)' }
    if ($Method -eq 'GET') {
        $global:bootstrapTest_gets++
        if ($global:bootstrapTest_paginate -and $global:bootstrapTest_gets -eq 1) {
            return [pscustomobject]@{ users = @(1..100 | ForEach-Object { @{ email="other$_@example.invalid" } }) }
        }
        return [pscustomobject]@{ users = $global:bootstrapTest_existing }
    }
    $payload = $Body | ConvertFrom-Json
    Assert ($payload.email_confirm -eq $true) 'new pilot users confirmed via Auth'
    Assert ($payload.password -eq 'Offline-test-password-42') 'password from hidden input'
    Assert (-not $payload.app_metadata) 'no global admin role metadata'
    $global:bootstrapTest_created += $payload.email
    return @{ id = [guid]::NewGuid().ToString() }
}
$emails = @('admin@lacarpinteria.demo','johan@lacarpinteria.demo','maestro.demo@lacarpinteria.demo')
foreach ($scenario in @('new','existing','partial','pagination','unconfirmed','duplicate','http-error','sql-error','interactive-default','cli-error','invalid-json','401','validate-only','legacy')) {
    $global:bootstrapTest_unauthorized=$scenario -eq '401'
    $global:bootstrapTest_cliFailure=$scenario -eq 'cli-error'; $global:bootstrapTest_badJson=$scenario -eq 'invalid-json'
    $global:bootstrapTest_sqlRuns=0; $global:bootstrapTest_prompts=0; $global:bootstrapTest_gets=0; $global:bootstrapTest_created=@(); $global:bootstrapTest_existing=@()
    $global:bootstrapTest_failHttp=$scenario -eq 'http-error'; $global:bootstrapTest_failSql=$scenario -eq 'sql-error'
    $global:bootstrapTest_paginate=$scenario -eq 'pagination'
    if ($scenario -in @('existing','partial','unconfirmed','duplicate')) {
        $global:bootstrapTest_existing=@($emails | ForEach-Object { @{ email=$_; email_confirmed_at='2026-01-01' } })
    }
    if ($scenario -eq 'partial') { $global:bootstrapTest_existing=@($global:bootstrapTest_existing[0]) }
    if ($scenario -eq 'unconfirmed') { $global:bootstrapTest_existing[0].email_confirmed_at=$null }
    if ($scenario -eq 'duplicate') { $global:bootstrapTest_existing+= $global:bootstrapTest_existing[0] }
    $env:SUPABASE_BOOTSTRAP_ADMIN_KEY='sb_secret_offline_test_only'
    if ($scenario -eq 'legacy') { $env:SUPABASE_BOOTSTRAP_ADMIN_KEY='eyJ.fake.legacy' }
    $failed=$false
    try { if ($scenario -eq 'validate-only') { & $scriptFile -ValidateAuth -UseEnvironmentKey } elseif ($scenario -in @('interactive-default','cli-error','invalid-json')) { & $scriptFile -Apply } else { & $scriptFile -Apply -UseEnvironmentKey } } catch { $failed=$true; Write-Host "Mock diagnostic: $($_.Exception.Message)" }
    $expectedFailure=$scenario -in @('unconfirmed','duplicate','http-error','sql-error','cli-error','invalid-json','401')
    Assert ($failed -eq $expectedFailure) "outcome $scenario"
    Assert (-not $env:SUPABASE_BOOTSTRAP_ADMIN_KEY) "credential removed $scenario"
    if ($scenario -eq 'existing') { Assert ($global:bootstrapTest_created.Count -eq 0 -and $global:bootstrapTest_prompts -eq 3) 'preserve existing passwords' }
    if ($scenario -eq 'partial') { Assert ($global:bootstrapTest_created.Count -eq 2) 'resume partial bootstrap' }
    if ($scenario -in @('new','pagination')) { Assert ($global:bootstrapTest_created.Count -eq 3 -and $global:bootstrapTest_sqlRuns -eq 1) 'create and provision' }
    if ($scenario -eq 'pagination') { Assert ($global:bootstrapTest_gets -eq 2) 'paginate Auth users' }
    if ($scenario -in @('unconfirmed','duplicate','http-error')) { Assert ($global:bootstrapTest_sqlRuns -eq 0) 'stop before SQL' }
    if ($scenario -eq 'interactive-default') { Assert ($global:bootstrapTest_prompts -eq 4) 'key plus three password prompts despite environment key' }
    if ($scenario -in @('cli-error','invalid-json')) { Assert ($global:bootstrapTest_prompts -eq 1 -and $global:bootstrapTest_created.Count -eq 0) 'prompt before CLI failure; no mutations' }
    if ($scenario -in @('401','http-error','validate-only')) { Assert ($global:bootstrapTest_prompts -eq 0 -and $global:bootstrapTest_created.Count -eq 0 -and $global:bootstrapTest_sqlRuns -eq 0) 'Auth failure/read-only requests no passwords and no writes' }
    Write-Host "PASS $scenario"
}
