param(
  [Parameter(Mandatory)][string]$ProjectId,
  [Parameter(Mandatory)][string]$HostingSiteId,
  [Parameter(Mandatory)][string]$ApiUrl
)
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$api=[uri]$ApiUrl
if($api.Scheme -ne 'https' -or $api.GetLeftPart([System.UriPartial]::Authority) -ne $ApiUrl){throw 'ApiUrl debe ser el origen HTTPS de Cloud Run, sin /api ni barra final.'}
if($HostingSiteId -notmatch '^[a-z0-9-]+$'){throw 'HostingSiteId no válido.'}
$config=Get-Content -LiteralPath (Join-Path $root 'firebase.json') -Raw | ConvertFrom-Json
$config.hosting | Add-Member -NotePropertyName site -NotePropertyValue $HostingSiteId -Force
$config.hosting.public=Join-Path $root 'Frontend/dist'
$file=Join-Path ([System.IO.Path]::GetTempPath()) ('vc-hosting-'+[guid]::NewGuid().ToString()+'.json')
[System.IO.File]::WriteAllText($file,(@{hosting=$config.hosting}|ConvertTo-Json -Depth 10),[System.Text.UTF8Encoding]::new($false))
$oldApi=$env:VITE_API_BASE_URL
$oldRelease=$env:VC_RELEASE_BUILD
Push-Location $root
try {
  $env:VITE_API_BASE_URL="$ApiUrl/api"
  $env:VC_RELEASE_BUILD='true'
  & bun run build
  if($LASTEXITCODE -ne 0){throw 'Build o revisión de secretos fallidos; no se publica.'}
  # Solo Hosting: nunca publicar reglas, índices ni otros recursos por accidente.
  & node node_modules/firebase-tools/lib/bin/firebase.js deploy --only hosting --project $ProjectId --config $file
  if($LASTEXITCODE -ne 0){throw 'Hosting no se publicó correctamente.'}
  Write-Output "Frontend publicado: https://$HostingSiteId.web.app"
} finally {
  $env:VITE_API_BASE_URL=$oldApi
  $env:VC_RELEASE_BUILD=$oldRelease
  Pop-Location
  Remove-Item -LiteralPath $file -Force
}
