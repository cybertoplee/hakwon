$baseUrl = "https://raw.githubusercontent.com/vladmandic/face-api/master/model/"
$destDir = "public/models"
$files = @(
    "tiny_face_detector-shard1",
    "tiny_face_detector-weights_manifest.json",
    "face_landmark_68-shard1",
    "face_landmark_68-weights_manifest.json",
    "face_recognition-shard1",
    "face_recognition-weights_manifest.json"
)

if (!(Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir }

foreach ($f in $files) {
    Write-Host "Downloading $f..."
    Invoke-WebRequest -Uri ($baseUrl + $f) -OutFile (Join-Path $destDir $f)
}
Write-Host "Done!"
