param([switch]$SkipBuild)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$image = 'visual-community-api:local-check'
$name = 'vc-production-check-' + [guid]::NewGuid().ToString('N')
$created = $false
Push-Location $root
try {
  & docker info --format '{{.OSType}}'
  if ($LASTEXITCODE -ne 0) { throw 'Inicia Docker Desktop antes de ejecutar esta prueba.' }
  if (-not $SkipBuild) {
    & docker build --tag $image .
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo construir la imagen de producción.' }
  }
  # Valores de prueba explícitos: nunca cargar .env ni montar credenciales.
  # Sin red externa, puertos publicados ni volúmenes del proyecto.
  & docker run --detach --name $name --network none --memory 512m --cpus 1 `
    --env FIREBASE_PROJECT_ID=production-container-check `
    --env FRONTEND_ORIGIN=https://container-check.example `
    --env ALGOLIA_APP_ID=container-check --env ALGOLIA_SEARCH_API_KEY=not-a-real-key `
    --env ALGOLIA_INDEX_NAME=container-check --env GEMINI_API_KEY=not-a-real-key `
    --env GEMINI_MODEL=container-check $image
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear el contenedor de prueba.' }
  $created = $true
  $checks = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'verify-container.mjs') -Raw -Encoding UTF8
  $result = $checks | & docker exec -i $name bun -
  if ($LASTEXITCODE -ne 0) { throw 'Falló la verificación del contenedor.' }
  $report = $result | ConvertFrom-Json
  & docker stop --timeout 10 $name
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo detener el contenedor de prueba.' }
  $exitCode = & docker inspect --format '{{.State.ExitCode}}' $name
  if ($LASTEXITCODE -ne 0 -or $exitCode -ne '0') { throw 'El cierre por SIGTERM no fue correcto.' }
  $imageId = & docker image inspect --format '{{.Id}}' $image
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo identificar la imagen verificada.' }
  $report | Add-Member -NotePropertyName gracefulShutdown -NotePropertyValue $true
  $report | Add-Member -NotePropertyName imageId -NotePropertyValue $imageId
  $report | Add-Member -NotePropertyName checkedAt -NotePropertyValue ([DateTime]::UtcNow.ToString('o'))
  $json = $report | ConvertTo-Json
  $null = New-Item -ItemType Directory -Path (Join-Path $root 'artifacts') -Force
  [System.IO.File]::WriteAllText((Join-Path $root 'artifacts/produccion-contenedor.json'), $json, [System.Text.UTF8Encoding]::new($false))
  Write-Output $json
} finally {
  if ($created) {
    # Nombre único de esta ejecución: no detener ni eliminar contenedores ajenos.
    & docker rm --force $name | Out-Null
  }
  Pop-Location
}
