# Räumliche Lichtkegel in der Desktop-Vorschau

Die GPU-Vorschau integriert das beleuchtete Nebelvolumen entlang des Blickstrahls. Die Bildschirmrechtecke begrenzen nur den Rasteraufwand; ihre Form bestimmt nicht mehr den sichtbaren Lichtkegel. Das analytisch berechnete Schnittintervall mit Kegel, Raumgrenzen und Empfangsebene wird mit acht Punkten abgetastet. Dadurch entsteht das Ende an der Empfangsfläche ohne die frühere abgeschnittene Strahlgrafik. Das Profil und die Öffnung stammen aus derselben Geometrie wie die Oberflächenprojektion.

WebGL ist der bevorzugte Desktop-Backend, WebGPU bleibt als Alternative erhalten. Canvas verwendet dieselbe Schnittberechnung mit vier Samples und etwa 12.000 Rasterpunkten pro Frame über die aktiven optischen Strahlen verteilt. Bei Canvas ist die Nebeldarstellung bewusst gröber; Oberflächen und Geräte behalten ihre Auflösung.

## Prüfung

- Numerischer Vergleich aus vier Kamerapositionen mit einer unabhängigen Referenz aus 32.768 Abtastpunkten pro Blickstrahl.
- Tests für Blickrichtung entlang der Achse, Null-Länge, Wände, Decke und Strahlen außerhalb des Kegels.
- Browserprüfung der tatsächlich kompilierten GLSL/WGSL-Shader, Bildvergleich, Kontextverlust und Ressourcenfreigabe.
- Einzelstrahl zur Decke; 20 bewegte Heads; 22 Geräte einschließlich Prismen/Gobos.
- Gesamttests: 759 von 762 bestanden. Drei bereits bestehende Fehler in rhythm-recovery / stage-motion bleiben bestehen.

## Messung

640 × 360, synchronisiert auf GPU-Abschluss; lokale Browser-Testumgebung, WebGPU über Software-Vulkan. Einzelne Läufe, keine Messung auf der Hardware des Benutzers.

| Szene | WebGL Median | Canvas Median | WebGPU Software Median |
| --- | ---: | ---: | ---: |
| 1 Deckenstrahl | 0,7 ms | 3,7 ms | 21,1 ms |
| 20 bewegte Heads | 3,7 ms | 14,2 ms | 129,1 ms |
| 22 Geräte mit optischen Effekten | 4,9 ms | 28,0 ms | 66,0 ms |

WebGPU ist in dieser Umgebung für diesen Renderpfad deutlich langsamer und deshalb nicht mehr der Standard. Größere Vorschaufenster können mehr Zeit kosten.

## Grenzen

Dies ist eine begrenzte Näherung für einfache Streuung, keine photometrische Simulation. Raum-Begrenzungsbox und Empfangsebene begrenzen das Volumen; beliebige konkave Raumgeometrie, gescannte Hindernisse und Geräteschatten werden nicht vollständig als Volumen-Okklusion ausgewertet. Indirektes Licht und Mehrfachstreuung fehlen. XR behält seinen bestehenden Geometriepfad.

Die Serverrouten enthalten das neue Volumenmodul. Beim vollständigen Modultest wurde außerdem die fehlende Route des gleichzeitig vorhandenen Raum-Preset-Moduls ergänzt; dessen Implementierung wurde nicht verändert.
