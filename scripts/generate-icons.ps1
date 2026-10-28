# Genera los íconos PWA de public/icons (diana del logo sobre naranja).
# Uso: powershell -File scripts/generate-icons.ps1 -OutDir public/icons
param([string]$OutDir)
Add-Type -AssemblyName System.Drawing
New-Item -ItemType Directory -Force $OutDir | Out-Null

$accent = [System.Drawing.ColorTranslator]::FromHtml('#FF6A1A')
$ink = [System.Drawing.ColorTranslator]::FromHtml('#1A0B02')

# size: lado del PNG. rounded: esquinas redondeadas (si no, fondo a sangre).
# mark: fracción del lado que ocupa la diana (el logo usa 0.66; maskable, menos).
function Draw-Icon([int]$size, [bool]$rounded, [double]$mark, [string]$file) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.Clear([System.Drawing.Color]::Transparent)
  $brush = New-Object System.Drawing.SolidBrush $accent
  if ($rounded) {
    $r = $size * 10 / 36 * 2
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddArc(0, 0, $r, $r, 180, 90)
    $path.AddArc($size - $r, 0, $r, $r, 270, 90)
    $path.AddArc($size - $r, $size - $r, $r, $r, 0, 90)
    $path.AddArc(0, $size - $r, $r, $r, 90, 90)
    $path.CloseFigure()
    $g.FillPath($brush, $path)
  } else {
    $g.FillRectangle($brush, 0, 0, $size, $size)
  }
  # Viewbox de 24 unidades del logo, centrado.
  $u = $size * $mark / 24
  $o = ($size - 24 * $u) / 2
  $pen = New-Object System.Drawing.Pen $ink, (2 * $u)
  $pen.StartCap = 'Round'; $pen.EndCap = 'Round'
  foreach ($cr in 9, 4.5) {
    $g.DrawEllipse($pen, [single]($o + (12 - $cr) * $u), [single]($o + (12 - $cr) * $u), [single](2 * $cr * $u), [single](2 * $cr * $u))
  }
  foreach ($l in @(@(12,1,12,6), @(12,18,12,23), @(1,12,6,12), @(18,12,23,12))) {
    $g.DrawLine($pen, [single]($o + $l[0] * $u), [single]($o + $l[1] * $u), [single]($o + $l[2] * $u), [single]($o + $l[3] * $u))
  }
  $bmp.Save((Join-Path $OutDir $file), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}

Draw-Icon 192 $true 0.66 'icon-192.png'
Draw-Icon 512 $true 0.66 'icon-512.png'
# Zona segura de maskable: círculo del 80 % del lado.
Draw-Icon 512 $false 0.5 'maskable-512.png'
# iOS redondea las esquinas solo.
Draw-Icon 180 $false 0.6 'apple-touch-icon-180.png'
