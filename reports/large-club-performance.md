# Großclub: Performance der Vorschau

## Änderungen

- GPU-Oberflächenprojektionen werden pro Renderer mit begrenztem LRU-Cache wiederverwendet. Farbe und Dimmer ändern keine Geometrie; Raum- und Zieländerungen invalidieren sie.
- Geräteboxen und Ringwinkel werden wiederverwendet. Kleine, entfernte Geräte nutzen einfachere Geometrie; ausgewählte Geräte behalten alle Details.
- Die diffuse Beleuchtung vermeidet wiederholtes Parsen von Farben und unnötige Vektor-Arrays. Ein Vergleich mit 1.000 bisherigen Ergebnissen war identisch.
- WebGL rendert Nebel bei mehr als 32 optischen Strahlen mit halber, bei mehr als 96 mit einem Drittel der Kantenauflösung. Die installierte Kapazität bestimmt diese Stufe; Dimmerwechsel auf Beats lösen keine Reallokation aus.
- Raum, Geräte, Lichtflecken und Szenentiefe bleiben in voller Auflösung. Eine Tiefenprüfung begrenzt die Nebelintegration; beim Hochskalieren werden Vordergrundkanten berücksichtigt. Ohne WEBGL_depth_texture bleibt der bisherige Pfad aktiv.
- Die Oberflächenhelligkeit kommt auf WebGL aus einer 256-Punkte-Tabelle des bisherigen Profils. WebGPU behält seinen bisherigen Renderpfad; CPU-Caches und Gerätedetails gelten für beide GPU-Backends.

## Messung

Tatsächliches Großclub-Preset: 72 Moving Heads, 72 PARs, 48 LED-Bars, 24 Traversen. Browser, 1280 × 720, WebGL über die lokale Vulkan-Testumgebung. Synthetische Wechsel zwischen nur bewegten Heads und allen 192 aktiven Leuchten; keine Messung eines laufenden Songs auf Benutzerhardware.

Je Phase 15 Warmup- und 50 Messframes. Beide Vergleichsläufe mit CPU-Profiling. gl.finish plus gl.getError erzwingen einen synchronen Rücklauf; reine Einreichungszeiten waren erheblich zu optimistisch. Szene-Mapping, Geometrieaufbereitung und Rendering sind enthalten.

Alle Zeiten in Millisekunden:

| Phase | Median vorher | Median nachher | p95 vorher | p95 nachher | CPU vorher | CPU nachher |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| quiet | 85.9 | 64.7 | 97.9 | 72.6 | 32 | 15.7 |
| intense | 318.5 | 142 | 334.8 | 156.4 | 35.8 | 16.9 |
| quiet-again | 84.3 | 59 | 97.4 | 68.6 | 29.7 | 14.4 |
| intense-again | 321 | 141 | 345.2 | 152.4 | 35.3 | 17.6 |

Die intensiven Phasen brauchen in diesem Stresstest deutlich weniger Zeit. Stabile 60 FPS sind hier trotzdem nicht erreicht. Die Software-Testumgebung ist keine FPS-Prognose für Benutzerhardware. CPU-Aufbereitung, Oberflächenüberlagerungen und Renderkosten bleiben bei 192 Leuchten relevant.

## Validierung

- Cache-Invalidierung, Blackout/Peak-Wechsel ohne Auflösungswechsel und Erhalt aller Strahlen bei geringerem Gerätedetail getestet.
- 364 DMX-Tests bestanden; Gesamtlauf: 763/766 bestanden, drei bekannte Fehler in rhythm-recovery / stage-motion.
- Browserprüfung mit Prismen/Gobos, tatsächlichen GLSL/WGSL-Shadern, Kontextverlust und Ressourcenfreigabe bestanden.
- Großclub-Bildvergleich volle Nebelauflösung gegen optimierte Auflösung; Vordergrundgeräte bleiben sichtbar. Zwischenzeitliche Überdeckung und Tiefenstreifen wurden vor Abschluss korrigiert.

Reproduktion: `VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/lvp_icd.json xvfb-run -a node scripts/bench-large-club-render.mjs`. Optional `CLUB_PROFILE=/tmp/club.cpuprofile` und `CLUB_SNAPSHOT=/tmp/club`.
