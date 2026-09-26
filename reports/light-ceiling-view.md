# Deckenlicht bei einer Kamera außerhalb des Raums

Die Deckenunterseite wurde nur gezeichnet, wenn die Kamera auch innerhalb des zweidimensionalen Raumgrundrisses stand. Eine externe Kamera unterhalb der Decke sah weiterhin die projizierten Lichtflecken, aber nicht deren Empfangsfläche.

Die Sichtbarkeit hängt jetzt von der Kamerahöhe relativ zur Decke ab. Von unten bleibt die Decke auch außerhalb des Grundrisses sichtbar. Die offene Planungsansicht von oben, AR und eigene importierte/gescannte Raumgeometrie behalten ihre bisherigen Bedingungen.

[Vorher/nachher, identische Szene und Kamera](../__mock/light-ceiling-before-after.jpg)

Die Strahlwinkel und Fleckgrößen wurden nicht vergrößert. Bei flachem Blick auf die Decke bleiben schmale Kegel geometrisch stark verkürzte Ellipsen. Behoben ist die fehlende Deckenfläche, nicht eine vermeintlich grundsätzlich falsche Perspektive dieser Ellipsen.

## Prüfung

Die neuen Tests scheiterten vor der Änderung bei externer Kamera und konkavem Grundriss. Danach bestanden 51 gezielte Tests einschließlich Wand-/Deckentreffern, Raumdarstellung und Renderer. Gesamtsuite: 745 Tests, 742 bestanden; dieselben drei bekannten Fehler in `rhythm-recovery.test.mjs` und `stage-motion.test.mjs`.

Browserprüfung mit acht nach oben gerichteten Köpfen für WebGPU, WebGL und Canvas bestanden, einschließlich Bildübereinstimmung, Kontextverlust und Ressourcenfreigabe. Die rechteckige Vergleichsszene benötigt lediglich zwei zusätzliche Deckendreiecke; kein weiterer Shader oder Renderdurchlauf wurde eingeführt. Hardware-FPS wurden nicht gemessen.

Reproduktion:

```sh
GPU_SYNC=1 STAGE_SCENE_FILE=scripts/fixtures/light-ceiling-view.json \
SNAPSHOT_PREFIX=/tmp/ceiling \
VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/lvp_icd.json \
xvfb-run -a node scripts/check-dmx-stage-gpu.mjs
```
