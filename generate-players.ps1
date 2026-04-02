param([int]$Year = (Get-Date).Year)

$BASE = 'https://statsapi.mlb.com/api/v1'
$OUT  = Join-Path $PSScriptRoot 'players.json'

function Normalize-Pos($abbr) {
    if ($abbr -in 'LF','CF','RF') { return 'OF' }
    if ($abbr -eq 'TWP')          { return 'DH' }
    if ([string]::IsNullOrWhiteSpace($abbr)) { return 'UTIL' }
    return $abbr
}
function Safe-Int($v)    { if ($null -eq $v -or "$v" -eq '') { return $null } return [int]$v }
function Safe-Double($v) { if ($null -eq $v -or "$v" -eq '') { return $null } return [double]$v }
function Team-From($abbr, $plid, $teamMap) {
    if ($abbr) { return $abbr }
    if ($teamMap.ContainsKey($plid)) { return $teamMap[$plid] }
    return ''
}

Write-Host "Fetching $Year data from MLB Stats API..."
$pr  = Invoke-RestMethod "$BASE/sports/1/players?season=$Year"
$hr  = Invoke-RestMethod "$BASE/stats?stats=season&group=hitting&season=$Year&playerPool=ALL&gameType=R&limit=3000"
$ptr = Invoke-RestMethod "$BASE/stats?stats=season&group=pitching&season=$Year&playerPool=ALL&gameType=R&limit=3000"
Write-Host "  Roster: $($pr.people.Count) | Hitters: $($hr.stats[0].splits.Count) | Pitchers: $($ptr.stats[0].splits.Count)"

if ($hr.stats[0].splits.Count -lt 100 -and $ptr.stats[0].splits.Count -lt 100) {
    $Year = $Year - 1
    Write-Host "Too few stats, fetching $Year instead..."
    $pr  = Invoke-RestMethod "$BASE/sports/1/players?season=$Year"
    $hr  = Invoke-RestMethod "$BASE/stats?stats=season&group=hitting&season=$Year&playerPool=ALL&gameType=R&limit=3000"
    $ptr = Invoke-RestMethod "$BASE/stats?stats=season&group=pitching&season=$Year&playerPool=ALL&gameType=R&limit=3000"
    Write-Host "  Roster: $($pr.people.Count) | Hitters: $($hr.stats[0].splits.Count) | Pitchers: $($ptr.stats[0].splits.Count)"
}

$posMap  = @{}
$teamMap = @{}
foreach ($p in $pr.people) {
    $posMap[$p.id]  = Normalize-Pos $p.primaryPosition.abbreviation
    $teamMap[$p.id] = if ($p.currentTeam.abbreviation) { $p.currentTeam.abbreviation } else { '' }
}

$pitcherRole = @{}
foreach ($s in $ptr.stats[0].splits) {
    $plid = [int]$s.player.id
    if (-not $plid) { continue }
    $gs  = [int]($s.stat.gamesStarted -as [int])
    $gpp = if ($s.stat.gamesPitched) { [int]$s.stat.gamesPitched } elseif ($s.stat.gamesPlayed) { [int]$s.stat.gamesPlayed } else { 0 }
    $pitcherRole[$plid] = if ($gs -ge 5 -and $gpp -gt 0 -and ($gs / $gpp) -ge 0.5) { 'SP' } else { 'RP' }
}

$players = [System.Collections.ArrayList]::new()
$seen    = [System.Collections.Generic.HashSet[int]]::new()

foreach ($s in $hr.stats[0].splits) {
    $plid = [int]$s.player.id
    if (-not $plid -or -not $seen.Add($plid)) { continue }
    $pos  = if ($posMap.ContainsKey($plid)) { $posMap[$plid] } else { 'UTIL' }
    if ($pos -in 'SP','RP','P') { continue }
    $st   = $s.stat
    $team = Team-From $s.team.abbreviation $plid $teamMap
    $obj  = [ordered]@{
        name = [string]$s.player.fullName
        pos  = [string]$pos
        team = [string]$team
        hr   = Safe-Int    $st.homeRuns
        avg  = Safe-Double $st.avg
        rbi  = Safe-Int    $st.rbi
        sb   = Safe-Int    $st.stolenBases
    }
    [void]$players.Add($obj)
}

foreach ($s in $ptr.stats[0].splits) {
    $plid = [int]$s.player.id
    if (-not $plid -or -not $seen.Add($plid)) { continue }
    $pos  = if ($pitcherRole.ContainsKey($plid)) { $pitcherRole[$plid] } elseif ($posMap.ContainsKey($plid) -and $posMap[$plid] -eq 'SP') { 'SP' } else { 'RP' }
    $st   = $s.stat
    $team = Team-From $s.team.abbreviation $plid $teamMap
    $ipv  = if ($st.inningsPitched) { [string]$st.inningsPitched } else { $null }
    $obj  = [ordered]@{
        name = [string]$s.player.fullName
        pos  = [string]$pos
        team = [string]$team
        era  = Safe-Double $st.era
        k    = Safe-Int    $st.strikeOuts
        w    = Safe-Int    $st.wins
        sv   = Safe-Int    $st.saves
        ip   = $ipv
    }
    [void]$players.Add($obj)
}

foreach ($p in $pr.people) {
    $plid = [int]$p.id
    if (-not $seen.Add($plid)) { continue }
    $pos   = if ($posMap.ContainsKey($plid)) { $posMap[$plid] } else { $null }
    $team  = if ($teamMap.ContainsKey($plid)) { $teamMap[$plid] } else { '' }
    if (-not $pos -or $pos -eq 'UTIL' -or -not $team) { continue }
    $fpos  = if ($pos -eq 'P') { 'RP' } else { $pos }
    if ($pos -in 'SP','RP','P') {
        $obj = [ordered]@{ name=[string]$p.fullName; pos=$fpos; team=$team; era=$null; k=$null; w=$null; sv=$null }
    } else {
        $obj = [ordered]@{ name=[string]$p.fullName; pos=$fpos; team=$team; hr=$null; avg=$null; rbi=$null; sb=$null }
    }
    [void]$players.Add($obj)
}

$output = [ordered]@{
    season      = $Year
    generatedAt = (Get-Date -Format 'o')
    count       = $players.Count
    players     = $players.ToArray()
}

$json = $output | ConvertTo-Json -Depth 5
[System.IO.File]::WriteAllText($OUT, $json, [System.Text.Encoding]::UTF8)
Write-Host "Done - wrote $($players.Count) players to players.json"