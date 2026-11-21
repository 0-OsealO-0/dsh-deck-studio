# animate-deck.ps1
# Design gate: -DryRun NEVER writes. It prints a per-slide motion proposal.
# Review it with the user, then run -Apply to write animations.json and validate.
#
# Examples:
#   .\animate-deck.ps1 -Project .\03-活动项目\20261117-示例 -Profile formal -DryRun
#   .\animate-deck.ps1 -Project .\03-活动项目\20261117-示例 -Profile formal -Apply
#   .\animate-deck.ps1 -Project .\03-活动项目\20261117-示例 -Profile campaign -Advanced slow-push,mask-reveal -DryRun
#
# Advanced flags:
#   slow-push    : image gets Fade + Grow/Shrink 104% over 4s (native; bleed/margin only)
#   micro-shift  : reported as a Morph recommendation; native path presets travel ~25%, too much
#   mask-reveal  : image/shape gets Wipe; rectangular approximation, not an organic mask
#
# This script never edits ppt-master source and never runs the exporter.

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Project,

    [ValidateSet('formal', 'campaign', 'literary')]
    [string]$Profile = 'formal',

    [string[]]$Advanced = @(),

    [ValidateRange(1, 6)]
    [int]$MaxMoves = 3,

    [ValidateRange(0.1, 1.0)]
    [double]$MaxAnimatedRatio = 0.7,

    [switch]$DryRun,
    [switch]$Apply,
    [switch]$Force,

    [string]$SkillRoot = '',

    [string]$Python = ''
)

# $PSScriptRoot is empty inside param defaults when launched via `powershell -File`,
# so resolve the bundled ppt-master after binding.
if (-not $SkillRoot) {
    $SkillRoot = Join-Path $PSScriptRoot '..\vendor\ppt-master'
}

# Standalone use: fall back to the machine's Python if the caller did not pass one.
if (-not $Python) {
    $Python = if ($env:DSH_DECK_PYTHON) { $env:DSH_DECK_PYTHON } else { 'python.exe' }
    if (-not (Test-Path -LiteralPath $Python)) {
        $cmd = Get-Command $Python -ErrorAction SilentlyContinue
        if ($cmd) { $Python = $cmd.Source }
    }
}

$ErrorActionPreference = 'Stop'

$advancedList = @()
foreach ($a in $Advanced) {
    $advancedList += @($a -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ })
}
$allowedAdvanced = @('slow-push', 'micro-shift', 'mask-reveal')
foreach ($a in $advancedList) {
    if ($allowedAdvanced -notcontains $a) {
        throw "Unknown -Advanced value '$a'. Allowed: $($allowedAdvanced -join ', ')."
    }
}

if ($DryRun -and $Apply) { throw 'Choose exactly one: -DryRun or -Apply.' }
if (-not $DryRun -and -not $Apply) { throw 'Choose -DryRun to review a proposal, or -Apply to write it.' }
if (-not (Test-Path -LiteralPath $Python)) { throw "Python not found: $Python. Install Python 3 or pass -Python <path>." }

$AnimConfig = Join-Path $SkillRoot 'scripts/animation_config.py'
$SvgToPptx = Join-Path $SkillRoot 'scripts/svg_to_pptx.py'
if (-not (Test-Path -LiteralPath $AnimConfig)) { throw "animation_config.py not found: $AnimConfig" }
if (-not (Test-Path -LiteralPath $SvgToPptx)) { throw "svg_to_pptx.py not found: $SvgToPptx" }

$Project = (Resolve-Path -LiteralPath $Project).Path
$SvgDir = Join-Path $Project 'svg_output'
if (-not (Test-Path -LiteralPath $SvgDir)) { throw "Missing svg_output/: $SvgDir" }

$Profiles = @{
    formal = @{
        transition = 'fade'
        transition_duration = 0.35
        stagger = 0.08
        trigger = 'after-previous'
        max = 2
        effects = @{
            title    = @{ effect = 'entrance_fade'; duration = 0.25 }
            subtitle = @{ effect = 'entrance_fade'; duration = 0.22 }
            quote    = @{ effect = 'entrance_fade'; duration = 0.40 }
            body     = @{ effect = 'entrance_fade'; duration = 0.20 }
            image    = @{ effect = 'entrance_fade'; duration = 0.30 }
            icon     = @{ effect = 'entrance_fade'; duration = 0.15 }
            shape    = @{ effect = 'entrance_wipe'; duration = 0.30; options = @{ direction = 'left' } }
            data     = @{ effect = 'entrance_wipe'; duration = 0.30; options = @{ direction = 'up' } }
            table    = @{ effect = 'entrance_fade'; duration = 0.30 }
            other    = @{ effect = 'entrance_fade'; duration = 0.25 }
        }
    }
    campaign = @{
        transition = 'fade'
        transition_duration = 0.30
        stagger = 0.10
        trigger = 'after-previous'
        max = 3
        effects = @{
            title    = @{ effect = 'entrance_wipe'; duration = 0.30; options = @{ direction = 'left' } }
            subtitle = @{ effect = 'entrance_fade'; duration = 0.25 }
            quote    = @{ effect = 'entrance_fade'; duration = 0.45 }
            body     = @{ effect = 'entrance_fade'; duration = 0.22 }
            image    = @{ effect = 'entrance_fade'; duration = 0.35 }
            icon     = @{ effect = 'entrance_fade'; duration = 0.18 }
            shape    = @{ effect = 'entrance_wipe'; duration = 0.30; options = @{ direction = 'left' } }
            data     = @{ effect = 'entrance_wipe'; duration = 0.35; options = @{ direction = 'up' } }
            table    = @{ effect = 'entrance_fade'; duration = 0.30 }
            other    = @{ effect = 'entrance_fade'; duration = 0.25 }
        }
    }
    literary = @{
        transition = 'fade'
        transition_duration = 0.55
        stagger = 0.12
        trigger = 'after-previous'
        max = 2
        effects = @{
            title    = @{ effect = 'entrance_fade'; duration = 0.45 }
            subtitle = @{ effect = 'entrance_fade'; duration = 0.40 }
            quote    = @{ effect = 'entrance_fade'; duration = 0.55 }
            body     = @{ effect = 'entrance_fade'; duration = 0.40 }
            image    = @{ effect = 'entrance_fade'; duration = 0.50 }
            icon     = @{ effect = 'entrance_fade'; duration = 0.25 }
            shape    = @{ effect = 'entrance_fade'; duration = 0.40 }
            data     = @{ effect = 'entrance_fade'; duration = 0.40 }
            table    = @{ effect = 'entrance_fade'; duration = 0.40 }
            other    = @{ effect = 'entrance_fade'; duration = 0.40 }
        }
    }
}

$Spec = $Profiles[$Profile]
$effectiveMax = [Math]::Min($MaxMoves, [int]$Spec.max)
$RolePriority = @{
    title = 1; subtitle = 2; quote = 2; body = 3; image = 3; data = 3;
    shape = 4; table = 4; icon = 5; other = 6
}

function Get-Role {
    param([string]$Id)
    $s = $Id.ToLowerInvariant()
    if ($s -match 'subtitle|subhead|dek|lead') { return 'subtitle' }
    if ($s -match 'title|heading|headline|kicker') { return 'title' }
    if ($s -match 'quote|pullquote') { return 'quote' }
    if ($s -match 'icon|ico|glyph|symbol') { return 'icon' }
    if ($s -match 'photo|image|img|picture|hero') { return 'image' }
    if ($s -match 'chart|graph|plot|kpi|metric|number|stat|data') { return 'data' }
    if ($s -match 'table|row|cell') { return 'table' }
    if ($s -match 'shape|block|panel|card|frame|bar|rule|line|pattern|texture|motif') { return 'shape' }
    if ($s -match 'body|copy|text|para|list|bullet|point|item|caption|note') { return 'body' }
    return 'other'
}

function Get-SlideGroups {
    param([string]$ProjectPath)
    $lines = & $Python $AnimConfig list-groups $ProjectPath 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "animation_config.py list-groups failed:`n$($lines -join "`n")"
    }
    $result = @()
    foreach ($line in $lines) {
        if ($line -match '^\s*([^:]+):\s*(.*)$') {
            $slide = $matches[1].Trim()
            $ids = @()
            if ($matches[2].Trim()) {
                $ids = @($matches[2] -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ -and $_ -notmatch '^\(no animatable groups\)$' })
            }
            $result += [pscustomobject]@{ Slide = $slide; Ids = $ids }
        }
    }
    return $result
}

function New-Row {
    param(
        [string]$Effect,
        [double]$Duration,
        [int]$Order,
        [string]$Trigger,
        $Options
    )
    $row = [ordered]@{
        effect = $Effect
        duration = $Duration
        order = $Order
        trigger = $Trigger
    }
    if ($null -ne $Options) { $row.effect_options = $Options }
    return $row
}

$slides = @(Get-SlideGroups -ProjectPath $Project)
if ($slides.Count -eq 0) { throw 'No slide groups found. Check svg_output/.' }

$warnings = @()
$plan = @()
$animatedSlides = 0

for ($si = 0; $si -lt $slides.Count; $si++) {
    $slide = $slides[$si]
    $all = @()
    $idx = 0
    foreach ($id in $slide.Ids) {
        $role = Get-Role -Id $id
        $all += [pscustomobject]@{ Id = $id; Role = $role; Index = $idx }
        $idx++
    }
    if ($all.Count -eq 0) { continue }

    $sorted = @($all | Sort-Object @{ Expression = { $RolePriority[$_.Role] } }, @{ Expression = { $_.Index } })
    $limit = $effectiveMax
    $selected = @($sorted | Select-Object -First $limit)
    $overflow = @($sorted | Select-Object -Skip $limit)

    if ($overflow.Count -gt 0) {
        $names = ($overflow | ForEach-Object { "$($_.Id)[$($_.Role)]" }) -join ', '
        $warnings += "$($slide.Slide): $($all.Count) groups, only $limit animated; static: $names"
    }
    if ($all.Count -eq 1) {
        $warnings += "$($slide.Slide): only one motion unit; consider leaving the page static"
    }

    $order = 1
    foreach ($g in $selected) {
        $eff = $Spec.effects[$g.Role]
        $effect = $eff.effect
        $duration = [double]$eff.duration
        $options = $null
        if ($eff.ContainsKey('options')) { $options = $eff.options }
        $note = ''
        $rows = @()

        if ($g.Role -eq 'image' -and ($advancedList -contains 'slow-push')) {
            $rows += New-Row -Effect 'entrance_fade' -Duration 0.55 -Order $order -Trigger $Spec.trigger -Options $null
            $note = 'slow push needs a Morph pair; native grow/shrink skipped (by/to conflict)'
            $warnings += "$($slide.Slide): slow-push requested on $($g.Id); use Morph pair or video"
        }
        elseif (($g.Role -eq 'image' -or $g.Role -eq 'shape') -and ($advancedList -contains 'mask-reveal')) {
            $effect = 'entrance_wipe'
            $duration = 0.45
            $options = @{ direction = 'left' }
            $note = 'mask-reveal approximation: rectangular wipe; organic mask needs cover layer or Morph'
            $rows += New-Row -Effect $effect -Duration $duration -Order $order -Trigger $Spec.trigger -Options $options
        }
        else {
            $rows += New-Row -Effect $effect -Duration $duration -Order $order -Trigger $Spec.trigger -Options $options
        }

        $effectLabel = ($rows | ForEach-Object {
            if ($_.effect -eq 'emphasis_grow_shrink') { "$($_.effect)(104%)" } else { $_.effect }
        }) -join ' + '

        $plan += [pscustomobject]@{
            Slide = $slide.Slide
            Group = $g.Id
            Role = $g.Role
            Effect = $effectLabel
            Duration = ($rows | ForEach-Object { $_.duration }) -join '/'
            Order = $order
            Note = $note
            Rows = $rows
        }
        $order++
    }
    if ($selected.Count -gt 0) { $animatedSlides++ }
}

if ($plan.Count -eq 0) { throw 'No motion units selected. The deck would stay static.' }

$ratio = $animatedSlides / [double]$slides.Count
if ($slides.Count -ge 4 -and $ratio -gt $MaxAnimatedRatio) {
    $warnings += ("{0:P0} of slides animate ({1}/{2}); above {3:P0}. Add static/breathing pages." -f $ratio, $animatedSlides, $slides.Count, $MaxAnimatedRatio)
}
if ($advancedList -contains 'micro-shift') {
    $warnings += 'micro-shift: native path presets travel ~25% of the object; 1-3% micro-shift needs a Morph pair (two pages) or video post-processing.'
}
$morphCandidates = @()
for ($i = 0; $i -lt $slides.Count - 1; $i++) {
    foreach ($id in $slides[$i].Ids) {
        $morphRole = Get-Role -Id $id
        if ($slides[$i + 1].Ids -contains $id -and $morphRole -in @('image', 'shape', 'data')) {
            $morphCandidates += "$($slides[$i].Slide) -> $($slides[$i + 1].Slide): $id [$morphRole]"
        }
    }
}
if ($morphCandidates.Count -gt 0) {
    $warnings += "Morph candidates (same group on adjacent slides): $($morphCandidates -join '; ')"
}

Write-Host ''
Write-Host "=== Motion proposal: $Profile ===" -ForegroundColor Cyan
Write-Host "Project : $Project"
Write-Host "Profile : $Profile  (transition=$($Spec.transition), $($Spec.transition_duration)s; trigger=$($Spec.trigger); stagger=$($Spec.stagger)s)"
Write-Host "Max     : $effectiveMax moves/page; $($plan.Count) rows across $animatedSlides/$($slides.Count) slides"
if ($Advanced.Count -gt 0) { Write-Host "Advanced: $($Advanced -join ', ')" }
Write-Host ''
$plan | Select-Object Slide, Group, Role, Effect, Duration, Order, Note | Format-Table -AutoSize

if ($warnings.Count -gt 0) {
    Write-Host 'Warnings:' -ForegroundColor Yellow
    foreach ($w in $warnings) { Write-Host "  - $w" -ForegroundColor Yellow }
    Write-Host ''
}

if ($DryRun) {
    Write-Host 'No files changed. Review this proposal, then run with -Apply.' -ForegroundColor Green
    return
}

# ---- Apply ----
$configPath = Join-Path $Project 'animations.json'
if ((Test-Path -LiteralPath $configPath) -and -not $Force) {
    throw "animations.json already exists. Use -Force to overwrite (a .bak is kept)."
}

$slidesJson = [ordered]@{}
foreach ($slide in $slides) {
    $slideMotions = @($plan | Where-Object { $_.Slide -eq $slide.Slide })
    if ($slideMotions.Count -eq 0) { continue }

    $groupsJson = [ordered]@{}
    foreach ($m in $slideMotions) {
        if ($m.Rows.Count -eq 1) {
            $groupsJson[$m.Group] = $m.Rows[0]
        }
        else {
            $groupsJson[$m.Group] = [ordered]@{ effects = @($m.Rows) }
        }
    }
    $slidesJson[$slide.Slide] = [ordered]@{
        transition = [ordered]@{ effect = $Spec.transition; duration = [double]$Spec.transition_duration }
        animation = [ordered]@{ effect = 'none'; duration = 0.3; stagger = [double]$Spec.stagger; trigger = $Spec.trigger }
        groups = $groupsJson
    }
}

$doc = [ordered]@{
    version = 1
    defaults = [ordered]@{
        transition = [ordered]@{ effect = $Spec.transition; duration = [double]$Spec.transition_duration; sound = $null }
        animation = [ordered]@{ effect = 'none'; duration = 0.3; stagger = [double]$Spec.stagger; trigger = $Spec.trigger }
    }
    slides = $slidesJson
}

$json = $doc | ConvertTo-Json -Depth 20
$backup = $null
if (Test-Path -LiteralPath $configPath) {
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $backup = "$configPath.bak-$stamp"
    Copy-Item -LiteralPath $configPath -Destination $backup -Force
}

$utf8 = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($configPath, $json, $utf8)
Write-Host "Wrote: $configPath" -ForegroundColor Green

$validate = & $Python $AnimConfig validate $Project 2>&1
if ($LASTEXITCODE -ne 0) {
    if ($backup) { Copy-Item -LiteralPath $backup -Destination $configPath -Force }
    else { Remove-Item -LiteralPath $configPath -Force }
    throw "Validation failed; previous state restored.`n$($validate -join "`n")"
}
Write-Host 'Validation: OK' -ForegroundColor Green
if ($backup) { Write-Host "Backup: $backup" }

Write-Host ''
Write-Host 'Next:' -ForegroundColor Cyan
Write-Host "  & `"$Python`" `"$SvgToPptx`" `"$Project`" --animation-config animations.json"
