# Strobo: komponierte Lichtmotive

## Umsetzung

- Eigene Ereignisfolgen statt regelmäßigem Durchschalten der Geräte: Einsätze, Haltezeiten, Ausklänge, Pausen und Antworten sind getrennt beschrieben.
- Sechs ausgearbeitete Grundmotive: reduzierte Raumfigur, laufendes Band, Wechsel der Flügel, verzahnte Gruppen, sich öffnender Fächer und paarweise aufgebaute Krone. Sie sind die neue aktive Planung; der ältere Katalog mit 120 Kombinationen bleibt für den bisherigen Demo-Pfad erhalten.
- Motivauswahl nach musikalischer Rolle, Gesangsanteil, Drive und Textur. Wiederkehrende musikalische Motive behalten ihre Auswahl und ihren Rhythmusanker.
- Gehaltene Motorpositionen bei Auswahlmotiven; langsame Entwicklung bei Band und Aufbau. Die Motorfahrt startet nicht mit jedem Lichtimpuls neu.
- Einsätze werden bis maximal 0,22 Beats an nahe erkannte Bassattacken angepasst. Die Anpassung füllt keine zusätzlichen Pausen mit Blitzen.
- Haupt-, Antwort- und Akzentgruppen besitzen eigene Einsatzzeiten. Akzente verwenden analysierte Ereignisse ab Stärke 0,6 mit mindestens 0,65 Sekunden Abstand; ruhige Passagen erhalten diese Akzente nicht.
- Stabile Farbrollen aus der vorhandenen Songfarbe, auch nach der physischen Raumverteilung. Kleine Aufbauten teilen die Rollen auf gespiegelte Gerätepaare auf; ein oder zwei Geräte übernehmen Hauptmotiv und Antworten selbst.
- Manuelle Bewegungs- und Flicker-Einstellungen bleiben wirksam.

## Prüfung

Verhaltenstests prüfen gehaltene Motorpositionen bei wechselnden Strahlenbildern, Wiederholbarkeit nach Seek, unabhängige Geometrie und Lichtfolge, musikalisch angepasste Einsätze, bewusst erhaltene Pausen, kleine und ungleich große Gruppen sowie Farbrollen nach der Raumverteilung.

Der Offline-Prüfpfad verwendete bislang teilweise den Automatisch-Renderer. Er wurde für Strobo auf dessen tatsächlichen Renderer umgestellt.

Vollständiger Durchlauf des vorhandenen Analyseplans von dmx-test.mp3: 0–216 Sekunden, 15 Hz, Club-Preset mit 48 Moving Heads. Messwerte stehen in strobo-motifs.json. Maximale Winkeländerung beim Wiedereinschalten: rund 1,16 Grad pro Bild. Diese Größe beschreibt die simulierte Motorbewegung und ist keine Aussage zur künstlerischen Wirkung.

## Verbleibende Abnahme

Kein synchroner audiovisueller Vergleich und kein Hardwaretest: Im Workspace liegt der vorbereitete Analyseplan vor, die ursprüngliche MP3 wurde nicht gefunden. Der Offline-Durchlauf verwendet ein Raum-Preset, nicht den gespeicherten Aufbau des Nutzers. Er umfasst keine GPU-Darstellung. Die Wirkung der Motive zur Musik muss deshalb noch in der laufenden Show beurteilt werden.
