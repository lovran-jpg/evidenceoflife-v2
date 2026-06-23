$srcOnly = Get-ChildItem -Path .\src -Recurse -File
$srcGroups = $srcOnly | Group-Object {
  switch -Regex ($_.Extension.ToLower()) {
    '^\.tsx$' { 'TSX (React)'; break }
    '^\.ts$'  { 'TS'; break }
    '^\.css$' { 'CSS'; break }
    '^\.json$' { 'JSON'; break }
    default   { "Other ($($_.Extension))" }
  }
}
$rows = foreach ($g in $srcGroups) {
  $loc = 0
  foreach ($f in $g.Group) {
    try { $loc += (Get-Content -LiteralPath $f.FullName -ErrorAction Stop | Measure-Object -Line).Lines } catch {}
  }
  [pscustomobject]@{ Type=$g.Name; Files=$g.Count; LOC=$loc }
}
$total = ($rows | Measure-Object LOC -Sum).Sum
Write-Host "=== src/ only ==="
$rows | Sort-Object LOC -Descending | ForEach-Object {
  [pscustomobject]@{
    Type=$_.Type; Files=$_.Files; LOC=$_.LOC
    'LOC%'=[math]::Round(($_.LOC/$total)*100,2)
  }
} | Format-Table -AutoSize
Write-Host "src/ total LOC: $total"
Write-Host ""
if (Test-Path package-lock.json) {
  Write-Host "package-lock.json LOC: $((Get-Content package-lock.json | Measure-Object -Line).Lines)"
}
