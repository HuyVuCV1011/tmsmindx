$body = @{
  month = 4
  week = 1
  year = 2026
  area = "HCM 1"
  senderName = "Tuan Nh"
  senderEmail = "tuannh@mindx.com.vn"
  message = "Chúc mừng sinh nhật. Sức khỏe và hạnh phúc luôn đồng hành!"
  birthdayNames = @("Nguyen Van A", "Tran Van B")
} | ConvertTo-Json

$web = New-Object System.Net.WebClient
$web.Headers.Add("Content-Type", "application/json")
$response = $web.UploadString("http://localhost:3000/api/birthday-wishes", "POST", $body)
Write-Host "POST Response:" -ForegroundColor Green
Write-Host $response
