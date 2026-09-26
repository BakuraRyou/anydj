# Übergang zwischen Boden und Wand

Ursache: `drawStageGeometry()` verwendete die Projektion auf alle Raumflächen nur für Moving Heads. Scheinwerfer und LED-Bars wurden als Ellipsen auf dem Boden gezeichnet und an dessen Rand abgeschnitten. Seit der breiteren Grundlichtdarstellung war das besonders auffällig.

Die gemeinsame Kegel-/Raumflächenberechnung wird jetzt für alle Lichttypen verwendet. Ein Lichtkegel kann gleichzeitig Boden, Wände und Decke treffen. Die horizontal breitere Abstrahlung der LED-Bar wird dabei berücksichtigt. Explizit begrenzte Wandzielbereiche behalten ihre gespeicherten Grenzen.

[Vorher/nachher bei gleicher Szene](../__mock/light-wall-seam-before-after.jpg)

Es werden keine zusätzlichen Lichter an die Wand gesetzt. Beide Flächen erhalten dieselben Intensitätsstufen des ursprünglichen Kegels. Das ersetzt auch das frühere Bodenprofil; seine Helligkeitsverteilung ist daher nicht pixelgleich. Die Lösung gilt für WebGPU, WebGL, Canvas und den gemeinsamen Polygonpfad.

## Prüfung

Die neue Regression scheiterte vor der Änderung für Scheinwerfer, LED-Bars und deren horizontalen Öffnungswinkel. Danach bestanden alle vier neuen Tests, einschließlich gleicher Intensitätsstufen auf beiden Seiten der Kante. Insgesamt 67 gezielte Optik-/Raum-/Renderer-Tests bestanden. Die ergänzende Prüfung von Raumplan und Kantenprojektion bestand mit 47 Tests.

Der bestehende Test für konkave Raumgrenzen prüft weiterhin, dass kein Bodenlicht in der ausgesparten Raumecke landet. Seine Erkennung wurde von einem festen Abstand von 12 mm auf einen kleinen positiven Abstand zur Bodenfläche angepasst: Die gemeinsame Projektion verwendet 6 mm, um Flackern überlagerter Flächen zu vermeiden.

Browservergleich mit vier statischen Scheinwerfern bei 640×360, GPU-Abschluss abgewartet, Software-Vulkan:

| Renderer | Vorher, Median | Nachher, Median |
|---|---:|---:|
| WebGPU | 12,0 ms | 13,7 ms |
| WebGL | 1,4 ms | 2,3 ms |
| Canvas | 1,3 ms | 2,1 ms |

Mehr Flächenberechnung und Geometrie, kein zusätzlicher Renderdurchlauf. Einzelne Softwaremessungen sind keine FPS-Zusage für reale Grafikkarten. Browserprüfungen für alle drei Renderer einschließlich Kontextverlust und Ressourcenfreigabe bestanden.

Reproduktion:

```sh
GPU_SYNC=1 STAGE_SCENE_FILE=scripts/fixtures/light-wall-seam.json \
SNAPSHOT_PREFIX=/tmp/seam \
VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/lvp_icd.json \
xvfb-run -a node scripts/check-dmx-stage-gpu.mjs
```
