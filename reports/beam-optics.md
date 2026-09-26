# Sichtbarere Strahloptik – 26. September 2026

Historischer Zwischenstand. Die spätere Abstimmung auf realistischere Lichtstreuung ist in [beam-realism.md](beam-realism.md) beschrieben.

Die vorherige Änderung verschob die Deckkraft innerhalb desselben schmalen Strahlprofils. Der Wechsel zu WebGPU/WebGL allein erzeugt keine andere Lichtästhetik.

## Änderung

- Strahlen erhalten einen weichen Saum bis zum 2,2-fachen physikalischen Radius. Der schmale Kern bleibt innerhalb des ursprünglichen Kegels und erhält einen kleinen Weißanteil.
- Eine kontinuierliche Belichtungskurve macht schwache Strahlen besser lesbar. Sie bleibt bei null vollständig dunkel und erhält die Reihenfolge der Dimmerwerte.
- Linsen bekommen einen größeren, weich auslaufenden Lichtschein mit hellem Zentrum.
- WebGPU und WebGL berechnen Kern und Saum innerhalb desselben bestehenden Quads. Canvas verwendet vorberechnete Masken und einen begrenzten Sprite-Cache (96 Einträge).
- Keine zusätzlichen GPU-Geometrien oder Renderdurchläufe. Die größeren Quads bearbeiten mehr Pixel; der Effekt ist nicht kostenlos. Neue Canvas-Farben benötigen einmalig ein eingefärbtes Sprite.
- Es handelt sich um eine stilisierte Vorschau von Licht in Dunst, keine Simulation der Lichtstreuung in einem dreidimensionalen Nebelvolumen. Der polygonale XR-Pfad bleibt bei seiner bisherigen Darstellung.

## Vergleich und Prüfung

[Vorher/nachher bei 22 % Leistung](../__mock/beam-optics-before-after.jpg): gleiche Kamera, Positionen, Bewegungsphase, Farbe und Leistung; Ausgabe direkt aus dem WebGPU-Renderziel. Die alte Fassung wurde vor der Änderung gesichert und gerendert. Zusätzlich wurden alle drei Renderer bei 75 % geprüft.

- 54 gezielte Tests bestanden: Optik, Blackout, unveränderte Eingangsdaten, Geometriebudget, Raumgrenzen, Projektionsmathematik, Desktop- und XR-Geometrie.
- Browserprüfung mit 20 bewegten Köpfen bei 22 % und 75 % bestanden: WGSL-/GLSL-Ausführung, WebGPU-/WebGL-Bildübereinstimmung, Kontextverlust, Canvas-Fallback und Ressourcenfreigabe.
- Im mittleren Strahlbereich (x=80…559, y=145…299 im 640×360-Bild) steigt der durchschnittliche RGB-Wert bei 22 % von 31,45 auf 64,73. Diese Bildmessung beschreibt den sichtbaren Unterschied, keine physikalische Lichtleistung.

Gemessene mediane JavaScript-Renderzeiten im Vergleich bei 22 %:

| Renderer | Vorher | Nachher |
|---|---:|---:|
| WebGPU | 15,4 ms | 15,7 ms |
| WebGL | 6,8 ms | 7,4 ms |
| Canvas | 9,5 ms | 10,0 ms |

Einzelne Durchläufe mit Software-Vulkan und virtueller Anzeige. Die Werte enthalten die gemeinsame CPU-Szenenberechnung, sind keine synchronisierten GPU-Zeiten und belegen keine FPS auf einer echten Grafikkarte. Die tatsächliche Browserinstanz des Nutzers war für diese Prüfung nicht zugänglich.

Reproduzieren:

```sh
LIGHT_POWER=.22 SNAPSHOT_PREFIX=/tmp/beam-optics \
VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/lvp_icd.json \
xvfb-run -a node scripts/check-dmx-stage-gpu.mjs
```

Die Browserprüfung schreibt einzelne Bilder für WebGPU, WebGL und Canvas sowie die Gesamtansicht. Ohne `LIGHT_POWER` werden 75 % verwendet.
