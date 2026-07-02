$baseUrl = "https://raw.githubusercontent.com/vladmandic/face-api/master/model/"
$destDir = "public/models"
$files = @(
    "tiny_face_detector.json",
    "tiny_face_detector.bin",
    "face_landmark_68.json",
    "face_landmark_68.bin",
    "face_recognition.json",
    "face_recognition.bin"
)

if (!(Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir }

foreach ($f in $files) {
    Write-Host "Downloading $f..."
    Invoke-WebRequest -Uri ($baseUrl + $f) -OutFile (Join-Path $destDir $f)
}
Write-Host "Done!"
