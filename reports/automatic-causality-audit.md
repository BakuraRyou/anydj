# Bereinigung der Automatik-Steuerung

## Nachgewiesene Ursachen und Änderungen

1. **Rhythmus erkannt, Bewegungen verworfen.** `arrangeShow` erkennt Schlagzeuganschläge auch bei lückenhaftem Beat-Raster und markiert sie als `instrument`. `musicalMovementEvents` akzeptierte jedoch nur außergewöhnliche Akzente relativ zur jeweiligen Passage. Gleichmäßige, kräftige Schläge gingen verloren. Jetzt sind diese gemessenen Zeitpunkte eigene Bewegungsankünfte, mindestens 0,8 Sekunden auseinander und ohne Dopplung nahe vorhandener Takte oder Akzente. Der Wechsel der Bewegungsphase zählt diese Ankünfte ebenfalls; ohne diese zweite Änderung blieben die Ziele identisch.
2. **Aufbau erkannt, danach als stehende Szene behandelt.** Gemessene `developments` erreichten die Bewegungssteuerung, wurden dort aber bei `sculpture` verworfen. Die Szeneneinstufung berücksichtigt jetzt mindestens zwei gemessene Entwicklungspunkte mit einem Fortschrittsanstieg von mindestens 0,2. Gemessene Stille hat weiterhin Vorrang. Die Ereigniszeiten und die Helligkeits-Akzentliste bleiben unverändert.
3. **Test prüfte den falschen Motor.** Der Test in `stage-motion.test.mjs` erwartete 32 Ziele und `section-flow` aus der alten Pattern-Steuerung, rief aber die aktuelle szenenbasierte Automatik auf. Er prüft nun explizit den weiterhin benötigten Pattern-Motor. Eine neue Prüfung deckt die aktuelle Automatik ab. Neu analysierte Pläne sind separate Objekte; bereits ausgewertete Pläne werden im Test nicht mehr verändert.

## Zuständigkeiten der Wirkungskette

| Schicht | Aufgabe | Grenze |
| --- | --- | --- |
| Audio-/Arrangement-Analyse | Tatsächliche Anschläge, Aufbau, Energie und Struktur ermitteln | Kein künstliches Beat-Raster als Ersatz erfinden |
| `dmx-light-scenes.js` | Ereignisse auswählen und Szenen/Gesten bestimmen | Vorhandene Analysebelege nicht durch widersprechende Schwellen verwerfen |
| `dmx-moving-cues.js` | Ziele, Fahrtzeiten und Akzentartikulation planen | Manuelle Stops und Motorgrenzen beachten |
| `dmx-group-motion.js` | Räumliche Gruppen und gemeinsame Form beschreiben | Musikalische Ausgangsbewegung nicht vollständig ersetzen |
| `dmx-ar-model.js` | Gruppen in erlaubte Raumflächen einpassen, Präsenz anwenden | Keine zusätzliche Abdunklung nach installierter Lampenzahl |
| Quellhelligkeit / Moving Presence | Quellpegel, danach räumliche Besetzung und Blackouts | Keine Spot-Maske vorab in den Moving-Head-Quellpegel einrechnen |
| Renderer | Dieselben Lichtwerte und Geometrien darstellen | Keine profilspezifische Shader-Korrektur für Automatisch |

Die letzten drei Regeln beschreiben die bereits vorgenommenen Korrekturen; dieser Durchgang ändert weder Shader noch Helligkeitskurven. Das ist eine gezielte Bereinigung der nachgewiesenen Widersprüche, keine vollständige Neuentwicklung der Lichtsteuerung. Die numerischen Gestaltungsparameter und das subjektive Erscheinungsbild bleiben separat zu beurteilen.

## Prüfung

Die zwei ursprünglich fehlschlagenden Rhythmus-/Aufbau-Tests bestehen ohne Abschwächung ihrer Erwartungen. Zusätzliche Prüfungen sichern echte Ereigniszeitpunkte, manuelle Bewegungsstopps und die Trennung alter und aktueller Steuerung. Die vollständige Suite wird nach diesen Änderungen ausgeführt; ihr Ergebnis wird in der Abschlussmeldung angegeben. Eine visuelle Abnahme der Nutzersitzung ist dadurch nicht ersetzt.
