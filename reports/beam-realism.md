# Licht im Dunst: sparsame Annäherung

Die anschließende Prüfung an der Videoreferenz und die Trennung von Grundlicht und Beams sind in [reference-light-study.md](reference-light-study.md) dokumentiert.

Die bisherige Vorschau betonte einen weißen Strahlkern und einen großen Glow. Die neue Abstimmung erhält die Lichtfarbe im gesamten Kegel, reduziert den äußeren Saum von 2,2 auf 1,12 Strahlradien und verkleinert den Linsenschein. Ein weicher radialer Verlauf ersetzt den weißen Kern.

[Vergleich mit identischer Kamera und 20 bewegten Köpfen](../__mock/beam-realism-before-after.jpg)

## Berechnung

- Pro Strahl wird am Mittelpunkt eine gerichtete Streuung berechnet. Die Winkelabhängigkeit verwendet Henyey–Greenstein mit g=0,35, gemischt mit einem gleichmäßigen Anteil. Grundlage: [Physically Based Rendering, Phase Functions](https://pbr-book.org/4ed/Volume_Scattering/Phase_Functions). Unsere Richtungskonvention ist einfallend entlang des Strahls, ausgehend zur Kamera; deshalb hat der Cosinus-Term gegenüber der pbrt-Konvention ein anderes Vorzeichen.
- Die Näherung berücksichtigt den Weg durch den Kegel, seine Breite sowie Abschwächung entlang des Licht- und Sichtweges. Der Wert ist begrenzt, damit Kameras nahe der Strahlachse keine Singularitäten erzeugen.
- Ein zusätzlicher Verlauf entlang des Strahls reduziert die Helligkeit mit der Ausbreitung. Die Belichtung ist kontinuierlich, erhält vollständigen Blackout und macht aus schwachen Dimmerwerten keine feste Mindesthelligkeit.
- Linsenschein und leuchtende Frontfläche berücksichtigen die Ausrichtung des Kopfes. Von hinten verschwindet die direkte Emission; beim Drehen gibt es einen weichen Übergang.
- WebGPU, WebGL und Canvas benutzen dieselbe Abstimmung. Die winkelabhängige Strahlberechnung gilt für die Desktop-Backends; der polygonale XR-Strahl bleibt eine einfachere Darstellung.

## Aufwand und Grenzen

Weiterhin ein Quad pro GPU-Strahl und pro sichtbarer Linse, keine weiteren Renderdurchläufe, keine Texturen für dreidimensionalen Nebel und kein Raymarching. Die zusätzliche Winkel- und Entfernungsauswertung erfolgt einmal pro Strahl. Durch den kleineren Saum sinkt die überzeichnete Fläche. Canvas behält seinen begrenzten Sprite-Cache.

Dies ist eine physikalisch motivierte Echtzeitnäherung mit künstlerisch abgestimmter Belichtung, keine radiometrisch kalibrierte Volumenintegration. Nebeldichte wird als gleichmäßig angenommen. Es gibt keine neue Schattenberechnung für beliebige Gegenstände im Raum; vorhandene Raumgrenzen und Lichtflächen bleiben zuständig. Hardwareabhängige Linsen, Gobos und reale Photometrie einzelner Geräte sind nicht modelliert.

Die vorhandene Mechanik begrenzt Pan auf 70°/s und Tilt auf 60°/s, Beschleunigung auf 280°/s² beziehungsweise 240°/s². Ihre Tests prüfen unter anderem plötzliche Zielwechsel, Pan-Übergänge und durchgehende Bewegungen über den Zenit. Diese generischen Vorschauparameter ersetzen keine gerätespezifische DMX-Kalibrierung.

## Prüfung

56 gezielte Tests bestanden: Streurichtung, Entfernung, Strahlbreite, Achsennähe, Blick auf die Linsenrückseite, Farberhalt, Blackout, Geometriebudget, Raumflächen und Bewegungsphysik.

Browserprüfung mit 20 bewegten Köpfen: echte WGSL-/GLSL-Ausführung, Bildübereinstimmung zwischen WebGPU und WebGL, Canvas, Kontextverlust und Ressourcenfreigabe. Vorher/Nachher wurde in identischer Szene mit 75 % Leistung gerendert. Die Browserprüfung bestand zusätzlich bei 22 % Leistung.

| JavaScript-Renderzeit, Median | Vorher | Nachher |
|---|---:|---:|
| WebGPU | 10,8 ms | 11,2 ms |
| WebGL | 6,4 ms | 7,9 ms |
| Canvas | 9,4 ms | 9,2 ms |

Einzelne Testdurchläufe auf Software-Vulkan, keine synchronisierten GPU-Messungen. Die gemeinsame CPU-Szenenberechnung ist enthalten. Diese Werte belegen keine FPS auf der Grafikkarte des Nutzers. Die GPU-Geometrie bleibt durch Tests auf sechs Vertices pro Strahl begrenzt.
