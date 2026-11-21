param(
    [Parameter(Mandatory = $true)][string]$Pptx,
    [string]$Pdf,
    [string]$Png,
    [int]$Width = 1600,
    [int]$Height = 900
)

$ErrorActionPreference = "Stop"

function Resolve-OutputPath([string]$Path) {
    if ([System.IO.Path]::IsPathRooted($Path)) { return $Path }
    return [System.IO.Path]::GetFullPath((Join-Path (Get-Location).Path $Path))
}

$pptxPath = (Resolve-Path $Pptx).Path
$pdfPath = if ($Pdf) { Resolve-OutputPath $Pdf } else { $null }
$pngPath = if ($Png) { Resolve-OutputPath $Png } else { $null }

$app = New-Object -ComObject PowerPoint.Application
try {
    $pres = $app.Presentations.Open($pptxPath, $true, $false, $false)
    # PowerPoint COM 刚打开就 SaveAs 偶发 COMException，等 2 秒可稳定。
    Start-Sleep -Seconds 2

    if ($pdfPath) {
        $pres.SaveAs($pdfPath, 32)
        Write-Output ("PDF  " + $pdfPath)
    }
    if ($pngPath) {
        $pres.Slides.Item(1).Export($pngPath, "PNG", $Width, $Height)
        Write-Output ("PNG  " + $pngPath)
    }

    $pres.Close()
}
finally {
    $app.Quit()
}
