#!/usr/bin/env pwsh
# Comprehensive Endpoint Testing Script for ChessChat
# Tests all API endpoints, worker functionality, and checks for 404 errors

$baseUrl = "https://chesschat.uk"
$testResults = @()

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Url,
        [string]$Method = "GET",
        [object]$Body = $null
    )
    
    Write-Host "`n=== Testing: $Name ===" -ForegroundColor Yellow
    Write-Host "URL: $Url" -ForegroundColor Gray
    Write-Host "Method: $Method" -ForegroundColor Gray
    
    try {
        $params = @{
            Uri = $Url
            Method = $Method
            UseBasicParsing = $true
            ContentType = "application/json"
        }
        
        if ($Body) {
            $params.Body = ($Body | ConvertTo-Json -Depth 10)
            Write-Host "Body: $($params.Body)" -ForegroundColor Gray
        }
        
        $response = Invoke-WebRequest @params
        $content = $response.Content
        
        Write-Host "✅ Status: $($response.StatusCode)" -ForegroundColor Green
        
        # Try to parse JSON
        try {
            $json = $content | ConvertFrom-Json
            Write-Host "Response: $($json | ConvertTo-Json -Depth 5 -Compress)" -ForegroundColor Cyan
        } catch {
            Write-Host "Response: $content" -ForegroundColor Cyan
        }
        
        $script:testResults += [PSCustomObject]@{
            Name = $Name
            Status = "PASS"
            StatusCode = $response.StatusCode
            Message = "Success"
        }
        
        return $true
    } catch {
        $statusCode = "N/A"
        $errorMsg = $_.Exception.Message
        
        if ($_.Exception.Response) {
            $statusCode = [int]$_.Exception.Response.StatusCode
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $errorBody = $reader.ReadToEnd()
            $reader.Close()
            
            Write-Host "❌ Status: $statusCode" -ForegroundColor Red
            Write-Host "Error: $errorBody" -ForegroundColor Red
        } else {
            Write-Host "❌ Error: $errorMsg" -ForegroundColor Red
        }
        
        $script:testResults += [PSCustomObject]@{
            Name = $Name
            Status = "FAIL"
            StatusCode = $statusCode
            Message = $errorMsg
        }
        
        return $false
    }
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "ChessChat Production Test Suite" -ForegroundColor Cyan
Write-Host "Base URL: $baseUrl" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Test 1: Capabilities Endpoint
Test-Endpoint -Name "Capabilities" -Url "$baseUrl/api/capabilities"

# Test 2: Chess Move (Worker) - Basic Test
Test-Endpoint -Name "Chess Move (Worker) - Basic" -Url "$baseUrl/api/chess-move" -Method "POST" -Body @{
    fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
    level = 1
}

# Test 2b: CPU Response with Mock Game Scenarios
Write-Host "`n=== Testing: CPU Response - Mock Game Scenarios ===" -ForegroundColor Yellow

$testScenarios = @(
    @{
        Name = "Opening Position (Level 1)"
        FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
        Level = 1
        ExpectedDepth = 10
    },
    @{
        Name = "Mid-Game Position (Level 3)"
        FEN = "r1bqkb1r/pppp1ppp/2n2n2/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4"
        Level = 3
        ExpectedDepth = 10
    },
    @{
        Name = "Tactical Position (Level 5)"
        FEN = "r1bq1rk1/ppp2ppp/2n5/3np3/1bB5/2NP1N2/PPP2PPP/R1BQR1K1 b - - 0 9"
        Level = 5
        ExpectedDepth = 10
    },
    @{
        Name = "Endgame Position (Level 7)"
        FEN = "8/5k2/3p4/1p1Pp3/pP2Pp2/P4P2/8/6K1 b - - 0 1"
        Level = 7
        ExpectedDepth = 10
    },
    @{
        Name = "Complex Position (Level 7)"
        FEN = "r1bq1rk1/pp3pbp/2np1np1/2p1p3/2P1P3/2NP1NP1/PP2PPBP/R1BQ1RK1 w - - 0 9"
        Level = 7
        ExpectedDepth = 10
    }
)

$cpuTestsPassed = 0
$cpuTestsFailed = 0

foreach ($scenario in $testScenarios) {
    Write-Host "`nTesting: $($scenario.Name)" -ForegroundColor Cyan
    Write-Host "FEN: $($scenario.FEN)" -ForegroundColor Gray
    Write-Host "Level: $($scenario.Level)" -ForegroundColor Gray
    
    try {
        $body = @{
            fen = $scenario.FEN
            level = $scenario.Level
        } | ConvertTo-Json
        
        $startTime = Get-Date
        $response = Invoke-WebRequest -Uri "$baseUrl/api/chess-move" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing
        $elapsed = ((Get-Date) - $startTime).TotalMilliseconds
        
        $json = $response.Content | ConvertFrom-Json
        
        # Validate response structure
        $validationErrors = @()
        
        if (-not $json.success) { $validationErrors += "success flag is false" }
        if (-not $json.move) { $validationErrors += "no move returned" }
        if (-not $json.diagnostics) { $validationErrors += "no diagnostics" }
        if ($json.diagnostics.depth -lt $scenario.ExpectedDepth) { 
            $validationErrors += "depth too low (got $($json.diagnostics.depth), expected $($scenario.ExpectedDepth))" 
        }
        if ($elapsed -gt 60000) { $validationErrors += "response too slow (${elapsed}ms)" }
        
        # Validate move format (should be UCI or SAN)
        if ($json.move -notmatch '^[a-h][1-8][a-h][1-8][qrbn]?$|^[NBRQK]?[a-h]?[1-8]?x?[a-h][1-8](=[QRBN])?[+#]?$|^O-O(-O)?[+#]?$') {
            $validationErrors += "invalid move format: $($json.move)"
        }
        
        if ($validationErrors.Count -eq 0) {
            Write-Host "   ✅ PASS" -ForegroundColor Green
            Write-Host "   Move: $($json.move)" -ForegroundColor Gray
            Write-Host "   Depth: $($json.diagnostics.depth)" -ForegroundColor Gray
            Write-Host "   Nodes: $($json.diagnostics.nodes)" -ForegroundColor Gray
            Write-Host "   Evaluation: $($json.diagnostics.evaluation)" -ForegroundColor Gray
            Write-Host "   Latency: ${elapsed}ms" -ForegroundColor Gray
            if ($json.diagnostics.mate) {
                Write-Host "   Mate in: $($json.diagnostics.mate)" -ForegroundColor Magenta
            }
            $cpuTestsPassed++
        } else {
            Write-Host "   ❌ FAIL" -ForegroundColor Red
            foreach ($error in $validationErrors) {
                Write-Host "      - $error" -ForegroundColor Red
            }
            $cpuTestsFailed++
        }
        
    } catch {
        Write-Host "   ❌ FAIL - Exception: $($_.Exception.Message)" -ForegroundColor Red
        $cpuTestsFailed++
    }
}

Write-Host "`nCPU Response Tests: $cpuTestsPassed passed, $cpuTestsFailed failed" -ForegroundColor $(if ($cpuTestsFailed -eq 0) { "Green" } else { "Red" })

$script:testResults += [PSCustomObject]@{
    Name = "CPU Response - Mock Scenarios"
    Status = $(if ($cpuTestsFailed -eq 0) { "PASS" } else { "FAIL" })
    StatusCode = "Multiple"
    Message = "$cpuTestsPassed/$($cpuTestsPassed + $cpuTestsFailed) scenarios passed"
}

# Test 3: Learning Ingest Game
Test-Endpoint -Name "Learning Ingest Game" -Url "$baseUrl/api/learning/ingest-game" -Method "POST" -Body @{
    userId = "test-user"
    gameId = "test-$(Get-Date -Format 'yyyyMMddHHmmss')"
    pgn = "1. e4 e5 2. Nf3 Nc6 3. Bb5"
    chatContext = @()
}

# Test 4: Chat Endpoint
Test-Endpoint -Name "Chat" -Url "$baseUrl/api/chat" -Method "POST" -Body @{
    message = "Test message"
    userId = "test-user"
}

# Test 5: Analyze Game
Test-Endpoint -Name "Analyze Game" -Url "$baseUrl/api/analyze-game" -Method "POST" -Body @{
    pgn = "1. e4 e5 2. Nf3 Nc6 3. Bb5"
    playerColor = "white"
    moveHistory = @()
}

# Test 6: Learning Plan
Test-Endpoint -Name "Learning Plan" -Url "$baseUrl/api/learning/plan"

# Test 7: Wall-E Post Game
Test-Endpoint -Name "Wall-E Post Game" -Url "$baseUrl/api/walle/postgame" -Method "POST" -Body @{
    gameResult = "win"
    mistakes = @()
}

# Test 8: Admin Learning Health (might be protected)
Test-Endpoint -Name "Admin Learning Health" -Url "$baseUrl/api/admin/learning-health"

# Test 9: Admin Worker Health
Test-Endpoint -Name "Admin Worker Health" -Url "$baseUrl/api/admin/worker-health"

# Test 10: Check common 404 sources
Write-Host "`n=== Checking for Common 404 Errors ===" -ForegroundColor Yellow
$notFoundUrls = @(
    "$baseUrl/api/wall-e/mistakes",
    "$baseUrl/api/wall-e/profile",
    "$baseUrl/api/wall-e/games",
    "$baseUrl/api/wall-e/metrics",
    "$baseUrl/api/health"
)

foreach ($url in $notFoundUrls) {
    Write-Host "`nChecking: $url" -ForegroundColor Gray
    try {
        $response = Invoke-WebRequest -Uri $url -Method GET -UseBasicParsing -ErrorAction Stop
        Write-Host "✅ Unexpectedly found: $($response.StatusCode)" -ForegroundColor Yellow
    } catch {
        if ($_.Exception.Response) {
            $statusCode = [int]$_.Exception.Response.StatusCode
            if ($statusCode -eq 404) {
                Write-Host "✅ Correctly returns 404 (expected)" -ForegroundColor Green
            } else {
                Write-Host "⚠️  Returns: $statusCode" -ForegroundColor Yellow
            }
        }
    }
}

# Summary
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Test Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$passed = ($testResults | Where-Object { $_.Status -eq "PASS" }).Count
$failed = ($testResults | Where-Object { $_.Status -eq "FAIL" }).Count
$total = $testResults.Count

Write-Host "`nTotal Tests: $total" -ForegroundColor White
Write-Host "Passed: $passed" -ForegroundColor Green
Write-Host "Failed: $failed" -ForegroundColor Red

Write-Host "`nDetailed Results:" -ForegroundColor White
$testResults | Format-Table -AutoSize

# Return exit code
if ($failed -gt 0) {
    Write-Host "`n❌ Some tests failed" -ForegroundColor Red
    exit 1
} else {
    Write-Host "`n✅ All tests passed" -ForegroundColor Green
    exit 0
}
