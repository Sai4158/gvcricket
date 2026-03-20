$ErrorActionPreference = 'Stop'
$base = 'http://127.0.0.1:3022'
$origin = $base
$results = @()
function Add-Result($name, $status, $notes) {
  $script:results += [pscustomobject]@{ name = $name; status = $status; notes = $notes }
}
function Try-Json($uri, $method='GET', $body=$null, $session=$null, $extraHeaders=@{}, $contentType='application/json') {
  $headers = @{ Origin = $origin }
  foreach ($k in $extraHeaders.Keys) { $headers[$k] = $extraHeaders[$k] }
  $params = @{ Uri = $uri; Method = $method; Headers = $headers; ErrorAction = 'Stop' }
  if ($session) { $params.WebSession = $session }
  if ($body -ne $null) {
    if ($contentType) { $params.ContentType = $contentType }
    $params.Body = if ($contentType -eq 'application/json') { ($body | ConvertTo-Json -Depth 10 -Compress) } else { $body }
  }
  try {
    $resp = Invoke-WebRequest @params
    $json = $null
    try { $json = $resp.Content | ConvertFrom-Json -Depth 20 } catch {}
    return [pscustomobject]@{ Ok = $true; StatusCode = [int]$resp.StatusCode; Json = $json; Text = $resp.Content; Headers = $resp.Headers }
  } catch {
    $r = $_.Exception.Response
    if ($r) {
      $reader = New-Object System.IO.StreamReader($r.GetResponseStream())
      $text = $reader.ReadToEnd()
      $reader.Close()
      $json = $null
      try { $json = $text | ConvertFrom-Json -Depth 20 } catch {}
      return [pscustomobject]@{ Ok = $false; StatusCode = [int]$r.StatusCode; Json = $json; Text = $text; Headers = $r.Headers }
    }
    throw
  }
}

# baseline auth checks
$resp = Try-Json "$base/api/director/sessions"
Add-Result 'director sessions without auth' ($(if($resp.StatusCode -eq 403){'PASS'}else{'FAIL'})) ("status=$($resp.StatusCode)")

$resp = Try-Json "$base/api/director/auth" 'POST' @{ pin = '9999' }
Add-Result 'director bad pin rejected' ($(if($resp.StatusCode -eq 401){'PASS'}else{'FAIL'})) ("status=$($resp.StatusCode)")

$resp = Try-Json "$base/api/director/auth" 'POST' @{ pin = '' }
Add-Result 'director empty pin rejected' ($(if($resp.StatusCode -eq 400){'PASS'}else{'FAIL'})) ("status=$($resp.StatusCode)")

$resp = Try-Json "$base/api/director/auth" 'POST' @{ pin = ' 0000 ' }
Add-Result 'director space pin accepted' ($(if($resp.StatusCode -eq 200){'PASS'}else{'FAIL'})) ("status=$($resp.StatusCode)")

# create temp draft session
$create = Try-Json "$base/api/sessions" 'POST' @{ name = 'Security Audit Temp' }
if ($create.StatusCode -ne 201) { throw "Create session failed: $($create.Text)" }
$sessionId = [string]$create.Json._id
$draftToken = [string]$create.Json.draftToken
Add-Result 'temp session created' 'PASS' ("session=$sessionId")

$setupBody = @{
  draftToken = $draftToken
  teamAName = 'Red'
  teamAPlayers = @('A1','A2','A3')
  teamBName = 'Blue'
  teamBPlayers = @('B1','B2','B3')
  overs = 2
}
$setup = Try-Json "$base/api/sessions/$sessionId/setup-match" 'POST' $setupBody
Add-Result 'draft setup valid' ($(if($setup.StatusCode -eq 201){'PASS'}else{'FAIL'})) ("status=$($setup.StatusCode)")

$setupBad = Try-Json "$base/api/sessions/$sessionId/setup-match" 'POST' (@{ draftToken = 'bad'; teamAName='Red'; teamAPlayers=@('A1','A2','A3'); teamBName='Blue'; teamBPlayers=@('B1','B2','B3'); overs=2 })
Add-Result 'draft token enforced' ($(if($setupBad.StatusCode -eq 403){'PASS'}else{'FAIL'})) ("status=$($setupBad.StatusCode)")

$startBody = $setupBody.Clone()
$startBody.tossWinner = 'Red'
$startBody.tossDecision = 'bat'
$start = Try-Json "$base/api/sessions/$sessionId/start-match" 'POST' $startBody
if ($start.StatusCode -ne 201) { throw "Start match failed: $($start.Text)" }
$matchId = [string]$start.Json._id
Add-Result 'live match started' 'PASS' ("match=$matchId")

# umpire auth
$umpireSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$authOk = Try-Json "$base/api/matches/$matchId/auth" 'POST' @{ pin = '0000' } $umpireSession
Add-Result 'umpire good pin accepted' ($(if($authOk.StatusCode -eq 200){'PASS'}else{'FAIL'})) ("status=$($authOk.StatusCode)")

$authBad = Try-Json "$base/api/matches/$matchId/auth" 'POST' @{ pin = '9999' }
Add-Result 'umpire bad pin rejected' ($(if($authBad.StatusCode -eq 401){'PASS'}else{'FAIL'})) ("status=$($authBad.StatusCode)")

# protected actions
$action = @{ type='score'; actionId='audit-1'; payload=@{ runs=1 } }
$unauthAction = Try-Json "$base/api/matches/$matchId/actions" 'POST' $action
Add-Result 'match action requires auth' ($(if($unauthAction.StatusCode -eq 403){'PASS'}else{'FAIL'})) ("status=$($unauthAction.StatusCode)")

$badAction = Try-Json "$base/api/matches/$matchId/actions" 'POST' @{ type='score'; actionId='audit-2'; payload=@{ runs='x' } } $umpireSession
Add-Result 'invalid action payload rejected' ($(if($badAction.StatusCode -eq 400){'PASS'}else{'FAIL'})) ("status=$($badAction.StatusCode)")

$goodAction = Try-Json "$base/api/matches/$matchId/actions" 'POST' $action $umpireSession
Add-Result 'valid action accepted' ($(if($goodAction.StatusCode -eq 200){'PASS'}else{'FAIL'})) ("status=$($goodAction.StatusCode)")

$replayAction = Try-Json "$base/api/matches/$matchId/actions" 'POST' $action $umpireSession
$replayed = $false
if ($replayAction.Json -and $replayAction.Json.replayed -eq $true) { $replayed = $true }
Add-Result 'duplicate action replay safe' ($(if($replayAction.StatusCode -eq 200 -and $replayed){'PASS'}else{'FAIL'})) ("status=$($replayAction.StatusCode); replayed=$replayed")

# score route spam/rate limit
$rateHit = $false
for ($i=0; $i -lt 12; $i++) {
  $resp = Try-Json "$base/api/matches/$matchId/actions" 'POST' @{ type='score'; actionId="spam-$i"; payload=@{ runs=1 } } $umpireSession
  if ($resp.StatusCode -eq 429) { $rateHit = $true; break }
}
Add-Result 'match action rate limit works' ($(if($rateHit){'PASS'}else{'PARTIAL'})) 'expected 429 under rapid spam'

# director auth and sessions
$directorSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$directorAuth = Try-Json "$base/api/director/auth" 'POST' @{ pin='0000' } $directorSession
Add-Result 'director good pin accepted' ($(if($directorAuth.StatusCode -eq 200){'PASS'}else{'FAIL'})) ("status=$($directorAuth.StatusCode)")

$directorList = Try-Json "$base/api/director/sessions" 'GET' $null $directorSession
$foundLive = $false
if ($directorList.Json) { $foundLive = @($directorList.Json.liveSessions | Where-Object { $_._id -eq $sessionId }).Count -gt 0 }
Add-Result 'director sees live session' ($(if($directorList.StatusCode -eq 200 -and $foundLive){'PASS'}else{'FAIL'})) ("status=$($directorList.StatusCode); found=$foundLive")

# walkie request auth and spam
$walkieBad = Try-Json "$base/api/matches/$matchId/walkie/request" 'POST' @{ token='bad'; participantId='p1'; role='spectator'; name='Spec' }
Add-Result 'walkie invalid token rejected' ($(if($walkieBad.StatusCode -eq 403){'PASS'}else{'FAIL'})) ("status=$($walkieBad.StatusCode)")

# image route protection / malformed upload
$imgNoAuth = Try-Json "$base/api/matches/$matchId/image" 'DELETE' @{ pin='0000' }
Add-Result 'image delete without umpire auth blocked' ($(if($imgNoAuth.StatusCode -eq 403){'PASS'}else{'FAIL'})) ("status=$($imgNoAuth.StatusCode)")

# logout csrf same-origin check
$logoutNoOrigin = $null
try {
  $logoutNoOriginResp = Invoke-WebRequest -UseBasicParsing -Uri "$base/api/director/auth" -Method DELETE -ErrorAction Stop
  $logoutNoOrigin = [pscustomobject]@{ StatusCode = [int]$logoutNoOriginResp.StatusCode }
} catch {
  $r = $_.Exception.Response
  $logoutNoOrigin = [pscustomobject]@{ StatusCode = [int]$r.StatusCode }
}
Add-Result 'director logout same-origin enforced' ($(if($logoutNoOrigin.StatusCode -eq 403){'PASS'}else{'FAIL'})) ("status=$($logoutNoOrigin.StatusCode)")

$results | ConvertTo-Json -Depth 5
