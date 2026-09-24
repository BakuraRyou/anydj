# Scroll-Performance des Gerätemanagers

Lokaler Chromium-Headless-Vergleich, 1280 × 900, Demo mit 20 Geräten,
3 Sekunden programmgesteuertes Scrollen im geöffneten 3D-Gerätemanager.
Gleicher Testaufbau vor und nach der Änderung; keine Aussage zur Bildrate
auf beliebiger Hardware.

| Messwert | Vorher | Nachher |
|---|---:|---:|
| Layoutberechnungen | 7.197 | 354 |
| SVG-Mutationen im Plan | 112.000 | 7.432 |
| Layout-Zeit | 1,085 s | 0,397 s |
| Hauptthread-Aufgabenzeit | 2,893 s | 2,170 s |
| Beobachtete Animationsframes | 172 | 180 |

Die Layout-Routine las zuvor nach SVG-Schreibzugriffen für jedes Gerät
`clientWidth`. Nun liefert ein ResizeObserver die Breite ohne wiederholte
synchrone Layoutabfragen. Geräte- und Lichtupdates werden pro Animationsframe
zusammengefasst; unveränderte Attribute bleiben unangetastet. Außerhalb des
sichtbaren Bereichs pausieren die laufenden Strahländerungen am Plan.
Strukturänderungen und ausgewählte Winkel-/Abstandswerte bleiben aktuell.

Auch die 3D-Canvasgröße wird über ResizeObserver erfasst. Die Musikleiste
ersetzt Texte nur noch bei tatsächlichen Änderungen und verwendet gespeicherte
Elementreferenzen. Berechnung, Wiedergabe und Hardwareausgabe werden dadurch
nicht gedrosselt. Observer und vorgemerkte Frames werden beim Entfernen
aufgeräumt.

Prüfung: `node scripts/check-device-manager-performance.mjs` mit großzügigen
Regressiongrenzen für Layoutanzahl und DOM-Mutationen; Browserprüfungen für
Geräte-/Zonen-/Zielbearbeitung, Songsteuerung, Standalone-Layout und 3D.
