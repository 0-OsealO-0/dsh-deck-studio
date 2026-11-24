"""Write per-page PNGs of a PPTX through PowerPoint COM (Windows only).

Usage:
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts/qa/render-slides.ps1 `
        -Pptx "C:\path\deck.pptx" -OutDir "C:\path\renders"

Then screenshot each SVG with headless Chrome (do NOT load the SVG inside an
<img>: file:// external images would not resolve and you would be comparing a
version without pictures):

    chrome --headless=new --disable-gpu --hide-scrollbars --window-size=1600,900 `
        --user-data-dir=<temp> --screenshot=<out.png> file:///<svg>
"""
param(
  [Parameter(Mandatory = $true)][string]$Pptx,
  [Parameter(Mandatory = $true)][string]$OutDir
)
$ErrorActionPreference = "Stop"
$app = New-Object -ComObject PowerPoint.Application
$pres = $app.Presentations.Open($Pptx, $true, $false, $false)
Start-Sleep -Seconds 2
if (!(Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir | Out-Null }
foreach ($i in 1..$pres.Slides.Count) {
  $path = Join-Path $OutDir ("slide-{0:D2}.png" -f $i)
  $pres.Slides.Item($i).Export($path, "PNG", 1600, 900)
}
$pres.Close()
$app.Quit()
