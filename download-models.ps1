$models = @(
    "tiny_face_detector_model-shard1",
    "tiny_face_detector_model-weights_manifest.json",
    "face_landmark_68_model-shard1",
    "face_landmark_68_model-weights_manifest.json",
    "face_recognition_model-shard1",
    "face_recognition_model-weights_manifest.json",
    "ssd_mobilenet_v1_model-shard1",
    "ssd_mobilenet_v1_model-weights_manifest.json"
)
$baseUrl = "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/"
$destDir = "public/models"

if (!(Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir }

foreach ($model in $models) {
    $destFile = Join-Path $destDir $model
    Write-Host "Downloading $model..."
    Invoke-WebRequest -Uri ($baseUrl + $model) -OutFile $destFile
}
Write-Host "Done!"
