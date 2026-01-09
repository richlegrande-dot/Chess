# Pre-Manual Test Script for Wall-E Learning Diagnostics Deployment
# Verifies endpoints and basic functionality before manual testing

param(
    [string]$BaseUrl = "https://chesschat.uk",
    [string]$AdminToken = "",
    [switch]$Troubleshoot = $false
)

# Set console encoding to UTF-8 for proper emoji display
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# Color helper function
function Write-Color {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

function Write-Box {
    param([string]$Message, [string]$Color = "Cyan")
    $border = "╔" + ("═" * 60) + "╗"
    $footer = "╚" + ("═" * 60) + "╝"
    Write-Color $border $Color
    Write-Color ("║  " + $Message.PadRight(58) + "║") $Color
    Write-Color $footer $Color
}

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Url,
        [int[]]$ExpectedStatus,
        [hashtable]$Headers = @{},
        [int]$TimeoutSeconds = 10
    )
    
    try {
        Write-Color "`n🔍 Testing: $Name" "Cyan"
        Write-Color "   URL: $Url" "Blue"
        
        $startTime = Get-Date
        
        $requestParams = @{
            Uri = $Url
            Method = 'GET'
            TimeoutSec = $TimeoutSeconds
            Headers = $Headers
            UseBasicParsing = $true
            ErrorAction = 'Stop'
        }
        
        try {
            $response = Invoke-WebRequest @requestParams
            $statusCode = [int]$response.StatusCode
        } catch {
            if ($_.Exception.Response) {
                $statusCode = [int]$_.Exception.Response.StatusCode.Value__
                $response = $_.Exception.Response
            } else {
                throw
            }
        }
        
        $duration = ((Get-Date) - $startTime).TotalMilliseconds
        
        $statusMatch = $ExpectedStatus -contains $statusCode
        $statusColor = if ($statusMatch) { "Green" } else { "Red" }
        $statusIcon = if ($statusMatch) { "✅" } else { "❌" }
        
        Write-Color "   $statusIcon Status: $statusCode (expected: $($ExpectedStatus -join ' or '))" $statusColor
        Write-Color "   ⏱️  Duration: $([int]$duration)ms" "Blue"
        
        # Try to parse JSON response
        if ($response.Content -and $response.Headers['Content-Type'] -match 'application/json') {
            try {
                $jsonBody = $response.Content | ConvertFrom-Json
                Write-Color "   📦 Response type: JSON" "Blue"
                if ($jsonBody.requestId) {
                    $shortId = $jsonBody.requestId.Substring(0, [Math]::Min(8, $jsonBody.requestId.Length))
                    Write-Color "   🆔 Request ID: ${shortId}..." "Blue"
                }
            } catch {
                Write-Color "   ⚠️  JSON parse failed" "Yellow"
            }
        } elseif ($response.Content) {
            $contentLength = $response.Content.Length
            if ($contentLength -lt 200) {
                $preview = $response.Content.Substring(0, [Math]::Min(100, $contentLength))
                Write-Color "   📦 Response: $preview" "Blue"
            } else {
                Write-Color "   📦 Response: $contentLength bytes" "Blue"
            }
        }
        
        return @{
            Success = $statusMatch
            Status = $statusCode
            Duration = $duration
            Response = $response
        }
    } catch {
        $errorMsg = $_.Exception.Message
        Write-Color "   ❌ Error: $errorMsg" "Red"
        
        if ($Troubleshoot) {
            Write-Color "`n   🔧 TROUBLESHOOTING:" "Yellow"
            
            if ($errorMsg -match "Unable to connect|connection.*closed|timed out") {
                Write-Color "   • Check if the server is running" "Yellow"
                Write-Color "   • Verify the URL: $Url" "Yellow"
                Write-Color "   • Check firewall settings" "Yellow"
                Write-Color "   • Try: Test-NetConnection -ComputerName $($Uri.Host) -Port $($Uri.Port)" "Yellow"
            } elseif ($errorMsg -match "SSL|certificate") {
                Write-Color "   • SSL/Certificate issue detected" "Yellow"
                Write-Color "   • The server certificate may be invalid" "Yellow"
                Write-Color "   • For testing, you can bypass with -SkipCertificateCheck (PowerShell 6+)" "Yellow"
            } elseif ($errorMsg -match "401|403|Unauthorized") {
                Write-Color "   • Authentication required" "Yellow"
                Write-Color "   • Check if ADMIN_TOKEN is set correctly" "Yellow"
                Write-Color "   • Verify token has not expired" "Yellow"
            } elseif ($errorMsg -match "DNS|resolve") {
                Write-Color "   • DNS resolution failed" "Yellow"
                Write-Color "   • Check if domain is correct: $Url" "Yellow"
                Write-Color "   • Try: nslookup $($Uri.Host)" "Yellow"
            }
        }
        
        return @{
            Success = $false
            Error = $errorMsg
        }
    }
}

function Start-PreManualTests {
    Write-Box "Wall-E Learning Diagnostics - Pre-Manual Test Suite" "Cyan"
    
    Write-Color "`n🌐 Target: $BaseUrl" "Cyan"
    if ($AdminToken) {
        Write-Color "🔑 Auth: Token provided" "Green"
    } else {
        Write-Color "⚠️  Auth: No token (admin tests will be limited)" "Yellow"
    }
    
    $results = @()
    
    # Test 1: Main site accessibility
    Write-Color "`n📋 Test Suite 1: Site Accessibility" "Yellow"
    $results += Test-Endpoint -Name "Main Site" -Url $BaseUrl -ExpectedStatus @(200, 301, 302)
    
    # Test 2: Health endpoint
    Write-Color "`n📋 Test Suite 2: API Health Check" "Yellow"
    $results += Test-Endpoint -Name "Worker Health" -Url "$BaseUrl/api/health" -ExpectedStatus @(200)
    
    # Test 3: Learning endpoints (no auth)
    Write-Color "`n📋 Test Suite 3: Learning Endpoints (Public)" "Yellow"
    $results += Test-Endpoint -Name "Learning Progress (Test User)" `
        -Url "$BaseUrl/api/learning/progress?userId=test" `
        -ExpectedStatus @(200, 404)  # 404 is OK if test user doesn't exist
    
    # Test 4: Admin endpoints (should require auth)
    Write-Color "`n📋 Test Suite 4: Admin Endpoints (Auth Required)" "Yellow"
    $results += Test-Endpoint -Name "Admin Learning Health (No Auth)" `
        -Url "$BaseUrl/api/admin/learning-health" `
        -ExpectedStatus @(401, 403)  # Should be unauthorized without token
    
    $results += Test-Endpoint -Name "Admin Learning Recent Events (No Auth)" `
        -Url "$BaseUrl/api/admin/learning-recent?limit=10" `
        -ExpectedStatus @(401, 403)  # Should be unauthorized without token
    
    # Test 5: Admin endpoints with auth (if token provided)
    if ($AdminToken) {
        Write-Color "`n📋 Test Suite 5: Admin Endpoints (With Auth)" "Yellow"
        
        $authHeaders = @{
            'Authorization' = "Bearer $AdminToken"
        }
        
        $results += Test-Endpoint -Name "Admin Learning Health (With Auth)" `
            -Url "$BaseUrl/api/admin/learning-health" `
            -ExpectedStatus @(200) `
            -Headers $authHeaders
        
        $results += Test-Endpoint -Name "Admin Learning Recent Events (With Auth)" `
            -Url "$BaseUrl/api/admin/learning-recent?limit=10" `
            -ExpectedStatus @(200) `
            -Headers $authHeaders
    } else {
        Write-Color "`n⚠️  Skipping authenticated tests (ADMIN_TOKEN not set)" "Yellow"
    }
    
    # Test 6: Static assets
    Write-Color "`n📋 Test Suite 6: Frontend Assets" "Yellow"
    $results += Test-Endpoint -Name "Index HTML" -Url "$BaseUrl/" -ExpectedStatus @(200)
    
    # Summary
    Write-Box "Test Summary" "Cyan"
    
    $passed = ($results | Where-Object { $_.Success }).Count
    $failed = ($results | Where-Object { -not $_.Success }).Count
    $total = $results.Count
    
    $passColor = if ($passed -eq $total) { "Green" } else { "Yellow" }
    Write-Color "`n✅ Passed: $passed/$total" $passColor
    Write-Color "❌ Failed: $failed/$total" $(if ($failed -gt 0) { "Red" } else { "Green" })
    
    if ($failed -gt 0) {
        Write-Color "`n⚠️  Some tests failed. Review errors above." "Yellow"
        Write-Color "   Note: 404 for test user or 401 for admin endpoints without auth is expected." "Yellow"
        
        if ($Troubleshoot) {
            Write-Color "`n🔧 TROUBLESHOOTING ENABLED - See detailed diagnostics above" "Yellow"
        } else {
            Write-Color "`n💡 Run with -Troubleshoot switch for detailed diagnostics" "Cyan"
        }
    } else {
        Write-Color "`n🎉 All tests passed! Ready for manual testing." "Green"
    }
    
    # Next steps
    Write-Box "Next Steps: Manual Testing" "Cyan"
    
    Write-Color "`n1. Open browser and navigate to:" "Blue"
    Write-Color "   $BaseUrl/admin" "Cyan"
    
    Write-Color "`n2. Unlock admin portal with password" "Blue"
    
    Write-Color "`n3. Click `"🤖 Wall-E Learning`" tab (7th tab)" "Blue"
    
    Write-Color "`n4. Verify:" "Blue"
    Write-Color "   ✓ System Health panel loads" "Yellow"
    Write-Color "   ✓ Configuration shows correct flags" "Yellow"
    Write-Color "   ✓ Database tables show counts" "Yellow"
    Write-Color "   ✓ Recent Events panel appears (may be empty)" "Yellow"
    Write-Color "   ✓ User lookup field works" "Yellow"
    Write-Color "   ✓ Troubleshooting guide sections expand" "Yellow"
    
    Write-Color "`n5. Test user lookup:" "Blue"
    Write-Color "   • Click `"👤 Get My ID`" button" "Yellow"
    Write-Color "   • Or play a game and use that user ID" "Yellow"
    Write-Color "   • Click `"🔍 Look Up`" to see results" "Yellow"
    
    Write-Color "`n6. Check browser console for errors (F12)" "Blue"
    
    Write-Color "`n" + ("═" * 63) "Cyan"
    
    return $failed
}

# Main execution
try {
    $failedCount = Start-PreManualTests
    
    if ($failedCount -gt 0) {
        Write-Color "`n⚠️  Pre-manual tests completed with $failedCount failure(s)" "Yellow"
        exit 0  # Don't fail startup, just warn
    } else {
        Write-Color "`n✅ Pre-manual tests completed successfully!" "Green"
        exit 0
    }
} catch {
    Write-Color "`n❌ Fatal error: $($_.Exception.Message)" "Red"
    Write-Host $_.ScriptStackTrace -ForegroundColor Red
    
    if ($Troubleshoot) {
        Write-Color "`n🔧 TROUBLESHOOTING MODE - Full Error Details:" "Yellow"
        Write-Host ($_ | Format-List * -Force | Out-String) -ForegroundColor Yellow
    }
    
    exit 1
}
