param(
  [string]$Pptx = "C:\Programming\SOL\proof-of-rent\hackathon-pitch\Proof-of-Rent-Hackathon-Pitch.pptx",
  [string]$OutDir = "C:\Programming\SOL\proof-of-rent\hackathon-pitch\rendered"
)
$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$app = New-Object -ComObject PowerPoint.Application
try {
  $app.Visible = -1
  $presentation = $app.Presentations.Open($Pptx, $true, $false, $false)
  try {
    $presentation.Export($OutDir, 'PNG', 1600, 900)
    Write-Output "EXPORTED $($presentation.Slides.Count) slides to $OutDir"
  }
  finally {
    $presentation.Close()
  }
}
finally {
  $app.Quit()
  [System.Runtime.Interopservices.Marshal]::ReleaseComObject($app) | Out-Null
}
