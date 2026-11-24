param(
  [Parameter(Mandatory = $true)][string]$PlanFile
)

# All paths arrive inside a UTF-8 JSON file: passing a Chinese deck name through
# the command line makes PowerShell decode argv with the ANSI code page, and
# PowerPoint answers with its misleading "Filename cannot exceed 255 characters".
$ErrorActionPreference = "Stop"
$app = $null
$deck = $null

function Set-Fields {
  param($Shape, $Slide, $Map, $SlideIndex, $Log, $InGroup = $false)
  if ($Shape.Type -eq 6) {
    foreach ($child in $Shape.GroupItems) { Set-Fields -Shape $child -Slide $Slide -Map $Map -SlideIndex $SlideIndex -Log $Log -InGroup $true }
    return
  }
  if ($Shape.HasTable -eq -1) {
    foreach ($row in $Shape.Table.Rows) {
      foreach ($cell in $row.Cells) {
        $t = $cell.Shape.TextFrame.TextRange.Text.Trim()
        foreach ($key in $Map.Keys) {
          if ($t -eq $key -or $t.Contains($key)) {
            $cellValue = $Map[$key]
            if ($cellValue -is [System.Management.Automation.PSCustomObject]) {
              $Log.Add("slide $SlideIndex : $key -> (表格里放不了图片，已跳过)") | Out-Null
              continue
            }
            $cell.Shape.TextFrame.TextRange.Text = $t.Replace($key, [string]$cellValue)
            $Log.Add("slide $SlideIndex : $key -> $cellValue") | Out-Null
          }
        }
      }
    }
    return
  }
  if ($Shape.HasTextFrame -ne -1) { return }
  if ($Shape.TextFrame.HasText -ne -1) { return }
  $text = $Shape.TextFrame.TextRange.Text.Trim()
  foreach ($key in $Map.Keys) {
    if (-not ($text -eq $key -or $text.Contains($key))) { continue }
    $value = $Map[$key]
    # 值是 {kind:"image", path:"…"} 时把占位替换成图片：顶层形状换成真正的
    # 图片对象（可裁切、可换）；组合里的子形状不能删，退化为图片填充。
    if ($value -is [System.Management.Automation.PSCustomObject] -and $value.kind -eq 'image') {
      if ($InGroup) {
        $Shape.Fill.UserPicture([string]$value.path)
        $Shape.TextFrame.TextRange.Text = ''
      }
      else {
        # COM returns these as doubles; AddPicture needs singles or PowerPoint
        # drops the geometry and inserts the picture at its own default size.
        $Slide.Shapes.AddPicture([string]$value.path, 0, -1, [single]$Shape.Left, [single]$Shape.Top, [single]$Shape.Width, [single]$Shape.Height) | Out-Null
        $Shape.Delete()
      }
      $Log.Add("slide $SlideIndex : $key -> <image $([System.IO.Path]::GetFileName([string]$value.path))>") | Out-Null
      return
    }
    $Shape.TextFrame.TextRange.Text = $text.Replace($key, [string]$value)
    $Log.Add("slide $SlideIndex : $key -> $value") | Out-Null
    return
  }
}

function ConvertTo-FieldMap {
  param($Fields)
  $map = @{}
  if ($null -eq $Fields) { return $map }
  foreach ($p in $Fields.PSObject.Properties) {
    if ($p.Value -is [System.Management.Automation.PSCustomObject]) { $map[$p.Name] = $p.Value }
    else { $map[$p.Name] = [string]$p.Value }
  }
  return $map
}

try {
  $raw = Get-Content -LiteralPath $PlanFile -Raw -Encoding UTF8
  # $Spec was typed [string]; reusing that name for the parsed object would
  # silently coerce it back to a string and Open("") fails with a bogus
  # "Filename cannot exceed 255 characters".
  $plan = ConvertFrom-Json -InputObject $raw
  $log = New-Object System.Collections.ArrayList

  $app = New-Object -ComObject PowerPoint.Application
  $app.Visible = -1
  $deck = $app.Presentations.Open([string]$plan.deck)
  if ($deck.Slides.Count -lt 1) { throw "deck opened with 0 slides" }

  foreach ($entry in @($plan.replace)) {
    if ($null -eq $entry) { continue }
    $target = [int]$entry.deckSlide
    # InsertFromFile treats Index as "insert after this slide" (0 = front), so a
    # replace inserts after target-1 and then deletes the page it pushed down.
    $deck.Slides.InsertFromFile([string]$plan.template, $target - 1, [int]$entry.templateSlide, [int]$entry.templateSlide) | Out-Null
    $deck.Slides.Item($target + 1).Delete()
    $fields = ConvertTo-FieldMap $entry.fields
    $slide = $deck.Slides.Item($target)
    # 换图片会删除并新建形状，先快照一份再遍历，避免边改边遍历跳过元素。
    foreach ($shape in @($slide.Shapes)) { Set-Fields -Shape $shape -Slide $slide -Map $fields -SlideIndex $target -Log $log }
  }

  foreach ($entry in @($plan.append)) {
    if ($null -eq $entry) { continue }
    $index = $deck.Slides.Count
    $deck.Slides.InsertFromFile([string]$plan.template, $index, [int]$entry.templateSlide, [int]$entry.templateSlide) | Out-Null
    $created = $deck.Slides.Count
    $deck.Slides.Item($created).MoveTo($deck.Slides.Count) | Out-Null
    $fields = ConvertTo-FieldMap $entry.fields
    $appended = $deck.Slides.Item($created)
    foreach ($shape in @($appended.Shapes)) { Set-Fields -Shape $shape -Slide $appended -Map $fields -SlideIndex $created -Log $log }
  }

  $deck.SaveAs([string]$plan.out)
  Write-Output ("OK slides=" + $deck.Slides.Count)
  foreach ($line in $log) { Write-Output ("field " + $line) }
}
finally {
  if ($deck) { try { $deck.Close() } catch {} }
  if ($app) { try { $app.Quit() } catch {} }
  Get-Process POWERPNT -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
}
