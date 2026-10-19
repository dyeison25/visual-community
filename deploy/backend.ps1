param(
  [Parameter(Mandatory)][ValidatePattern('^[a-z][a-z0-9-]{4,62}$')][string]$ProjectId,
  [Parameter(Mandatory)][string]$RuntimeServiceAccount,
  [Parameter(Mandatory)][string]$FrontendOrigin,
  [Parameter(Mandatory)][string]$GeminiModel,
  [Parameter(Mandatory)][string]$AlgoliaAppId,
  [string]$Region='us-central1',
  [string]$Repository='visual-community',
  [string]$Service='visual-community-api',
  [string]$AlgoliaIndex='visual_community_content',
  [string]$GeminiSecret='visual-community-gemini:latest',
  [string]$AlgoliaSearchSecret='visual-community-algolia-search:latest'
)
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
foreach($origin in $FrontendOrigin.Split(',')) {
  $uri=[uri]$origin
  if($uri.Scheme -ne 'https' -or $uri.GetLeftPart([System.UriPartial]::Authority) -ne $origin) {throw 'Usa orígenes HTTPS exactos, separados por coma.'}
}
if($RuntimeServiceAccount -notmatch '^[A-Za-z0-9_-]+@[a-z0-9-]+\.iam\.gserviceaccount\.com$'){throw 'Cuenta de servicio no válida.'}
foreach($value in @($Region,$Repository,$Service,$GeminiModel,$AlgoliaAppId,$AlgoliaIndex,$GeminiSecret,$AlgoliaSearchSecret)) {
  if($value -notmatch '^[A-Za-z0-9_.:/-]+$'){throw 'Parámetro de despliegue no válido.'}
}
$null=Get-Command gcloud -ErrorAction Stop
$tag=Get-Date -Format 'yyyyMMdd-HHmmss'
$image="$Region-docker.pkg.dev/$ProjectId/$Repository/api:$tag"
$envFile=Join-Path ([System.IO.Path]::GetTempPath()) ('vc-runtime-'+[guid]::NewGuid().ToString()+'.json')
# Solo configuración no secreta. Las claves se referencian en Secret Manager.
$settings=@{NODE_ENV='production';HOST='0.0.0.0';FIREBASE_PROJECT_ID=$ProjectId;FRONTEND_ORIGIN=$FrontendOrigin;GEMINI_MODEL=$GeminiModel;ALGOLIA_APP_ID=$AlgoliaAppId;ALGOLIA_INDEX_NAME=$AlgoliaIndex}
[System.IO.File]::WriteAllText($envFile,($settings|ConvertTo-Json),[System.Text.UTF8Encoding]::new($false))
Push-Location $root
try {
  & gcloud builds submit . --project $ProjectId --tag $image
  if($LASTEXITCODE -ne 0){throw 'Cloud Build no terminó correctamente; no se despliega.'}
  & gcloud run deploy $Service --project $ProjectId --region $Region --image $image --platform managed --allow-unauthenticated --service-account $RuntimeServiceAccount --port 8080 --memory 512Mi --cpu 1 --min-instances 0 --max-instances 1 --concurrency 20 --timeout 120 --env-vars-file $envFile --set-secrets "GEMINI_API_KEY=$GeminiSecret,ALGOLIA_SEARCH_API_KEY=$AlgoliaSearchSecret"
  if($LASTEXITCODE -ne 0){throw 'No se publicó la API.'}
  & gcloud run services describe $Service --project $ProjectId --region $Region --format 'value(status.url)'
} finally {
  Pop-Location
  Remove-Item -LiteralPath $envFile -Force
}
