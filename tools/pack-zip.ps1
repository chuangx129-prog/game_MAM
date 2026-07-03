# 生成 EdgeOne「直接上传」用的部署包(桌面:妈妈的无影脚-部署包.zip)
# 用法:powershell -ExecutionPolicy Bypass -File tools\pack-zip.ps1
$root = Split-Path $PSScriptRoot -Parent
$staging = Join-Path $env:TEMP 'mam-deploy'
if (Test-Path $staging) { Remove-Item -Recurse -Force $staging }
New-Item -ItemType Directory -Force $staging | Out-Null

# 只打包运行游戏需要的文件
Copy-Item "$root\index.html" $staging
Copy-Item "$root\icon.jpeg" $staging
Copy-Item -Recurse "$root\js" "$staging\js"
Copy-Item -Recurse "$root\sound" "$staging\sound"

$dst = Join-Path ([Environment]::GetFolderPath('Desktop')) '妈妈的无影脚-部署包.zip'
if (Test-Path $dst) { Remove-Item -Force $dst }
Compress-Archive -Path "$staging\*" -DestinationPath $dst
Write-Host "打包完成: $dst ($([math]::Round((Get-Item $dst).Length/1MB,2)) MB)"
Write-Host "去 https://console.cloud.tencent.com/edgeone/pages 项目里重新上传即可更新线上版本"
