$exclude = @('node_modules','dist','.git','build','.next','coverage')
$files = Get-ChildItem -Recurse -File | Where-Object {
  $p = $_.FullName
  -not ($exclude | Where-Object { $p -match "\\$_\\" })
}

$groups = $files | Group-Object {
  switch -Regex ($_.Extension.ToLower()) {
    '^\.tsx$'   { 'TypeScript (TSX/React)'; break }
    '^\.ts$'    { 'TypeScript'; break }
    '^\.jsx$'   { 'JavaScript (JSX)'; break }
    '^\.js$'    { 'JavaScript'; break }
    '^\.mjs$'   { 'JavaScript (ESM)'; break }
    '^\.cjs$'   { 'JavaScript (CJS)'; break }
    '^\.css$'   { 'CSS'; break }
    '^\.scss$'  { 'SCSS'; break }
    '^\.html$'  { 'HTML'; break }
    '^\.json$'  { 'JSON'; break }
    '^\.md$'    { 'Markdown'; break }
    '^\.sql$'   { 'SQL'; break }
    '^\.toml$'  { 'TOML'; break }
    '^\.yml$|^\.yaml$' { 'YAML'; break }
    '^\.svg$'   { 'SVG'; break }
    '^\.(png|jpg|jpeg|gif|webp|ico)$' { 'Images'; break }
    default     { "Other ($($_.Extension))" }
  }
}

$rows = foreach ($g in $groups) {
  $loc = 0
  foreach ($f in $g.Group) {
    if ($f.Extension -match '\.(png|jpg|jpeg|gif|webp|ico|svg)$') { continue }
    try { $loc += (Get-Content -LiteralPath $f.FullName -ErrorAction Stop | Measure-Object -Line).Lines } catch {}
  }
  [pscustomobject]@{ Type = $g.Name; Files = $g.Count; LOC = $loc }
}

$totalLoc = ($rows | Measure-Object LOC -Sum).Sum
$totalFiles = ($rows | Measure-Object Files -Sum).Sum

$rows | Sort-Object LOC -Descending | ForEach-Object {
  $pctLoc = if ($totalLoc) { [math]::Round(($_.LOC / $totalLoc) * 100, 2) } else { 0 }
  $pctFiles = if ($totalFiles) { [math]::Round(($_.Files / $totalFiles) * 100, 2) } else { 0 }
  [pscustomobject]@{
    Type = $_.Type
    Files = $_.Files
    'Files%' = $pctFiles
    LOC = $_.LOC
    'LOC%' = $pctLoc
  }
} | Format-Table -AutoSize

Write-Host ""
Write-Host "Total files counted: $totalFiles"
Write-Host "Total lines of code: $totalLoc"
