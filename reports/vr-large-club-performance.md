# VR: große Lichtanlagen

## Umsetzung

- Der immersive Renderer liegt in `public/dmx-vr-renderer.js`; Sitzungen und Bedienung bleiben in `dmx-stage-vr.js`.
- XR startet mit der vom Browser empfohlenen Auflösung (`framebufferScaleFactor: 1`) statt Faktor 0,85. Das ist keine Zusicherung nativer Panelauflösung.
- Lichtflecken verwenden einen weichen Shader mit einer kleinen Profiltabelle statt bis zu 24 Polygonlagen. Ein eigener begrenzter Projektionscache erhält feste Lichtziele über Frames hinweg.
- Nebel nutzt die gemeinsame volumetrische Lichtberechnung. Bei mehr als 96 installierten optischen Strahlen wird er zunächst mit einem Drittel der Kantenauflösung berechnet. Raum, Geräte und Bedienpult bleiben in voller XR-Auflösung.
- Die Tiefenkarte begrenzt die Nebelintegration. Beim Hochskalieren werden Vordergrundkanten berücksichtigt. Gepackte Tiefe funktioniert auch ohne `WEBGL_depth_texture`.
- `ANGLE_instanced_arrays` bündelt alle sichtbaren Lichtvolumen in einen Draw pro Auge. Ohne Erweiterung oder bei nicht kompilierbarem Instancing-Shader bleibt ein geprüfter Einzelaufruf-Pfad verfügbar.
- Geometrie wird einmal für beide Augen aufgebaut. Navigation läuft als GPU-Matrixtransformation. Unveränderte Weltgeometrie wird nicht erneut hochgeladen; CPU- und GPU-Puffer werden wiederverwendet.
- Entfernte Geräte erhalten weniger Details; ausgewählte Geräte bleiben detailliert. Sichtbarkeit wird am gesamten Lichtvolumen geprüft, sodass Lichter hinter dem Betrachter weiterhin nach vorn leuchten können.
- Eine Lastregelung wertet Bildabstände und die vom XR-System gemeldete Bildrate aus. Anhaltende Überlast reduziert die Nebelauflösung bis auf ein Viertel und erhöht unterstützte Rand-Foveation. Die Rückkehr zu höherer Qualität erfolgt langsamer. Einzelne Pausen und Blackouts lösen keine beatweisen Qualitätswechsel aus. Ohne gemeldete Bildrate bleibt die kapazitätsabhängige Qualität aktiv.
- Hauptserver, Brillenzugang und lokale VR-Simulation liefern die neuen Module aus. Die Simulation erhält auch die benötigten transitiven Importe.

Es werden keine aktiven Lichter wegen eines Mengenlimits abgeschaltet. Die CPU baut bewegte Szenengeometrie weiterhin pro Bild auf; dies ist kein vollständig instanzierter Geräte-Renderer.

## Messung

Großclub-Preset: 72 Moving Heads, 72 PARs, 48 LED-Bars und 24 Traversen. Zwei perspektivische Augen mit je 1024 × 1024 Pixeln. Chrome, Software-Vulkan (lavapipe), synthetische Zielbewegungen und Dimmerwechsel. Je Phase 15 Aufwärmframes und 30 Messframes, mit Rückgabe an die Browser-Frame-Schleife zwischen den Bildern.

Enthalten sind Raum-/Show-Mapping, Geometrieaufbereitung, beide Augen und Rendering. `gl.finish()` plus `gl.getError()` erzwingen einen GPU-Rücklauf. Beide Renderer verwenden dieselbe Testpuffergröße: Die zusätzlich angehobene Auflösung im realen XR-Betrieb ist in diesem Vergleich nicht enthalten. Der alte VR-Renderer wird mit der aktuellen gemeinsamen Szenengeometrie geladen.

Zeiten in Millisekunden:

| Phase | Median vorher | Median nachher | p95 vorher | p95 nachher |
| --- | ---: | ---: | ---: | ---: |
| Nur Moving Heads aktiv | 28,4 | 9,8 | 76,7 | 706,2 |
| Alle 192 Lichter aktiv | 128,2 | 14,5 | 8082,0 | 25,0 |
| Blackout | 10,9 | 4,5 | 16,9 | 8,9 |
| Wieder alle 192 aktiv | 73,8 | 32,3 | 7689,9 | 188,9 |

Die Softwareumgebung zeigt starke Ausreißer und Unterschiede zwischen den beiden intensiven Phasen. Die Messung belegt eine deutliche Verbesserung der typischen Bildzeiten in diesem Test, keine stabilen Headset-FPS. Auch der neue Renderer erreicht hier nicht durchgehend die 13,9 ms für 72 Hz oder 11,1 ms für 90 Hz. Dafür ist ein Lauf auf der tatsächlichen Brille mit deren Augenauflösung erforderlich.

In beiden intensiven Phasen wurden 192 Strahlen vorbereitet und für beide Augen insgesamt 384 sichtbare Strahlen berücksichtigt. Die CPU-Geometrieaufbereitung lag im Median bei etwa 10 ms. Rohwerte: [JSON](vr-large-club-performance.json). Bilder: [vorher](vr-large-club-before.png), [nachher](vr-large-club-after.png).

## Validierung

- 389 DMX-, VR-, AR- und Brillenzugangstests bestanden.
- Der lokale Simulator liefert den vollständigen Importgraph der VR-Ansicht samt benötigten Stilen aus.
- Echter Browser: Shaderkompilierung, Stereo-Parallaxe, Bedienpult, Controllerstrahl, Pufferwiederverwendung und transparente AR-Hintergründe bestanden; keine GL-Fehler.
- Instancing und der Ersatzpfad liefern im Vergleichstest identische Pixel, auch mit asymmetrischer Projektion und gedrehtem Raumursprung.
- Tiefentest: Nebel verändert ein davor liegendes Gerät nicht; nach Entfernen des Geräts wird der Strahl sichtbar.
- Ressourcen lassen sich wiederholt freigeben; nach Freigabe wird weiteres Rendering zurückgewiesen.
- Tests für Cache-Invalidierung, Schwarzschaltung/Wiederanlauf aller 192 Lichter, Detailreduktion, Augenmatrizen, Volumensichtbarkeit und stabile Lastregelung bestanden.

## Reproduktion

```sh
node --test test/dmx-*.test.mjs test/vr-preview.test.mjs
VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/lvp_icd.json xvfb-run -a node scripts/check-vr-renderer.mjs
VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/lvp_icd.json VR_EYE_SIZE=1024 VR_REPORT=/tmp/vr-results.json xvfb-run -a node scripts/bench-vr-large-club.mjs
```

Die Vergleichsbasis lässt sich mit `git show 9dc17a826e76e7d0ab9b0e2f736eddcd4324493e:public/dmx-stage-vr.js > /tmp/dmx-stage-vr-before.js` wiederherstellen.

Für einen Vorher/Nachher-Vergleich zusätzlich `VR_BASELINE=/tmp/dmx-stage-vr-before.js` setzen; diese Datei enthält den bisherigen vollständigen VR-Renderer. `VR_SNAPSHOT=/tmp/vr` speichert die Bilder beider Augen je Phase. `VR_EYE_SIZE` erlaubt weitere Auflösungen.

`createStageVR(...).performance` liefert die letzten Rendererwerte. `buildMs` und `submitMs` sind Aufbereitungs-/Einreichungszeiten, keine isolierten GPU-Zeiten. `uploadedBytes` zählt die Uploads der Weltgeometrie; Instanz- und Bedienpultdaten sind darin nicht enthalten. Bildabstände, verpasste Frames und Qualitätsstufe werden ergänzt, wenn die XR-Laufzeit ihre Bildrate meldet.

API-Grundlagen: [WebXR-Spezifikation](https://www.w3.org/TR/webxr/), [Meta: Fixed Foveated Rendering](https://developers.meta.com/horizon/documentation/web/webxr-ffr/). Rand-Foveation betrifft den finalen XR-Puffer; die separaten Nebelpuffer werden über ihre eigene Auflösung entlastet.
