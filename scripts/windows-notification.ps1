# Windows Notification for Claude Code
# Compatible with Windows 10/11 using multiple fallback methods

param(
    [string]$Title = "Claude Code",
    [string]$Message = "Task Completed"
)

# Method 1: Try Windows Toast Notification (Windows 10/11)
function Send-ToastNotification {
    try {
        [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null
        $template = '<toast><visual><binding template="ToastText02"><text id="1">' + $Title + '</text><text id="2">' + $Message + '</text></binding></visual><audio src="ms-winsoundevent:Notification.Default"/></toast>'

        $xml = New-Object Windows.Data.Xml.Dom.XmlDocument
        $xml.LoadXml($template)
        $toast = [Windows.UI.Notifications.ToastNotification]::new($xml)
        [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('ClaudeCode').Show($toast)
        return $true
    } catch {
        return $false
    }
}

# Method 2: Use Windows Forms Balloon Notification (Fallback)
function Send-BalloonNotification {
    try {
        Add-Type -AssemblyName System.Windows.Forms
        Add-Type -AssemblyName System.Drawing

        $notification = New-Object System.Windows.Forms.NotifyIcon
        $notification.Icon = [System.Drawing.SystemIcons]::Information
        $notification.BalloonTipIcon = [System.Windows.Forms.ToolTipIcon]::Info
        $notification.BalloonTipTitle = $Title
        $notification.BalloonTipText = $Message
        $notification.Visible = $true
        $notification.ShowBalloonTip(5000)
        Start-Sleep -Milliseconds 5000
        $notification.Dispose()
        return $true
    } catch {
        return $false
    }
}

# Try methods in order
$success = Send-ToastNotification
if (-not $success) {
    Write-Host "Toast notification failed, trying balloon notification..."
    $success = Send-BalloonNotification
}

if ($success) {
    Write-Host "Notification sent successfully"
    exit 0
} else {
    Write-Host "All notification methods failed"
    exit 1
}
