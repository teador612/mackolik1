$ErrorActionPreference = 'Stop'
$workspace = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$node = 'C:\Users\Süleyman\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
$builder = Join-Path $workspace 'work\build_mackolik.mjs'
if (-not (Test-Path -LiteralPath $node)) { throw "Bundled Node.js bulunamadı: $node" }
if (-not (Test-Path -LiteralPath $builder)) { throw "Güncelleme betiği bulunamadı: $builder" }
& $node $builder
if ($LASTEXITCODE -ne 0) { throw "Mackolik bülteni güncellenemedi. Çıkış kodu: $LASTEXITCODE" }
