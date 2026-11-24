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
  param($Shape, $Map, $SlideIndex, $Log)
  if ($Shape.Type -eq 6) {
    foreach ($child in $Shape.GroupItems) { Set-Fields -Shape $child -Map $Map -SlideIndex $SlideIndex -Log $Log }
    return
  }
  if ($Shape.HasTable -eq -1) {
    foreach ($row in $Shape.Table.Rows) {
      foreach ($cell in $row.Cells) {
        $t = $cell.Shape.TextFrame.TextRange.Text.Trim()
        foreach ($key in $Map.Keys) {
          if ($t -eq $key -or $t.Contains($key)) {
            $cell.Shape.TextFrame.TextRange.Text = $t.Replace($key, $Map[$key])
            $Log.Add("slide $SlideIndex : $key -> $($Map[$key])") | Out-Null
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
    if ($text -eq $key -or $text.Contains($key)) {
      $Shape.TextFrame.TextRange.Text = $text.Replace($key, $Map[$key])
      $Log.Add("slide $SlideIndex : $key -> $($Map[$key])") | Out-Null
      return
    }
  }
}

function ConvertTo-FieldMap {
  param($Fields)
  $map = @{}
  if ($null -eq $Fields) { return $map }
  foreach ($p in $Fields.PSObject.Properties) { $map[$p.Name] = [string]$p.Value }
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
    foreach ($shape in $deck.Slides.Item($target).Shapes) { Set-Fields -Shape $shape -Map $fields -SlideIndex $target -Log $log }
  }

  foreach ($entry in @($plan.append)) {
    if ($null -eq $entry) { continue }
    $index = $deck.Slides.Count
    $deck.Slides.InsertFromFile([string]$plan.template, $index, [int]$entry.templateSlide, [int]$entry.templateSlide) | Out-Null
    $created = $deck.Slides.Count
    $deck.Slides.Item($created).MoveTo($deck.Slides.Count) | Out-Null
    $fields = ConvertTo-FieldMap $entry.fields
    foreach ($shape in $deck.Slides.Item($created).Shapes) { Set-Fields -Shape $shape -Map $fields -SlideIndex $created -Log $log }
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
