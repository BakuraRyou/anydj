# 150 Formationen für Automatisch

[Geometrischer Katalog](catalog.svg) · [Katalogdaten](catalog.json)

40 bestehende Formationen plus 110 neue räumliche Varianten: elf Grundbahnen werden mit zehn Anordnungen für Paare und Reihen kombiniert. Die Kombinationen verändern Zielgeometrie, Verteilung und Verlauf. Farben und Geschwindigkeit zählen nicht als eigene Formationen.

## Neue Grundbahnen

Blütenbögen, Gewölbebögen, Tore, Terrassen, Polygonzüge, Wellenketten, Segel, Schweife, Gitter, Kronen und Helices.

## Räumliche Anordnungen

Gemeinsame Bewegung, getrennte Reihenbänder, gegenläufige Reihen, gestaffelte Ebenen, verflochtene Paare, verschachtelte Rahmen, seitlich geöffnete Figuren, gefaltete Figuren, diagonale Bänder und Ringe.

## Musikalische Auswahl

Die Auswahl berücksichtigt Energie, rhythmischen Antrieb, Gesangsanteil und spektrale Helligkeit. Ruhige Entwicklungen verwenden passende sanfte Varianten; Aufbauten erhalten öffnende Figuren. Die vorhandene Erinnerung an Motive und die Gewichtung gegen häufige Wiederholung bleiben aktiv. Übergänge werden weiterhin anhand von Position und Bewegungsrichtung eingepasst.

Die erweiterte Auswahl wird einmal je Songplan berechnet und zwischengespeichert. Der Automatik-Wiedergabepfad verwendet diesen Katalog; Show behält seine bisherige Auswahl. Gespeicherte Analysedaten können weiterverwendet werden. Nach dem Neuladen wird die Automatik-Auswahl neu berechnet.

## Prüfung

- Genau 150 verfügbare Einträge, davon 110 neue unterschiedliche geometrische Signaturen über mehrere Reihen und Bewegungsphasen.
- Endliche, begrenzte und kontinuierliche Ziele; Spiegelpaare mit 2, 3, 4, 8 und 32 Geräten pro Gruppe geprüft.
- Musikabhängige und reproduzierbare Auswahl, Erhalt manueller Bewegungspausen und des Show-Katalogs.
- Live-Pfad von `movingPresenceAt` bis Raumzuordnung geprüft: neue Figuren werden verwendet; automatische Wandprojektion bleibt aus.
- 20 gezielte Katalog-, Raum-, Gruppen- und Kontinuitätstests bestanden.
- Gesamtsuite beim Implementierungsstand vor dem zusätzlichen Live-Pfad-Test: 1007 bestanden, ein bestehender LAN-Preview-Fehler (`/dmx-strobe-score.js`, HTTP 403).

Das SVG stellt Zielbahnen schematisch dar. Kleine oder eng begrenzte Aufbauten können verschiedene Varianten optisch ähnlicher erscheinen lassen. Eine visuelle Abnahme aller Figuren im GPU-Renderer und ein Frametiming-Benchmark stehen noch aus.

Reproduktion: `node scripts/review-automatic-catalog.mjs`.

## Ergänzung: musikalische Bewegungsabläufe

Die 150 Geometrien werden in Automatisch jetzt mit sechs Ablaufrollen kombiniert:

| Ablauf | Wirkung und musikalischer Einsatz |
| --- | --- |
| Gemeinsamer Schwenk | Reihen bewegen sich mit gemeinsamer Phase durch die Tiefe; trägt einen gleichmäßigen Groove. |
| Atmen | Kleine gemeinsame Öffnungsbewegung für ruhige, noch aktive Passagen. |
| Öffnen | Spiegelbildliches Aufspannen; bei Aufbauten einmal über die Passage, sonst zyklisch. |
| Welle | Bewegung und Lichtstärke wandern zusammen über Spiegelpaare und Reihen. |
| Gruppenwechsel | Reihen übernehmen abwechselnd die Führung; bei einer Reihe wechseln Spiegelpaare. |
| Zurücknehmen | Nach einem deutlichen Energierückgang zieht sich die Figur geordnet zurück. |

Die Rollen werden an den bestehenden musikalischen Passagegrenzen ausgewählt. Zusammengehörige Analysefragmente behalten ihre Rolle. Energie, Antrieb, Gesang und der Vergleich zur vorigen Passage begrenzen die Auswahl, bevor Wiederholungen gewichtet werden. Ruhige Passagen bekommen dadurch auch bei langer Dauer keinen erzwungenen hektischen Gruppenwechsel.

Ähnliche Silhouetten teilen sich nun eine Wiederholungsfamilie über alte und neue Namen hinweg. Beispielsweise zählen die gestaffelten Gewölbe, Kronen und bisherigen gestaffelten Säulen gemeinsam. Diese Zuordnung ist eine geometrisch begründete Heuristik, kein automatischer Wahrnehmungsnachweis.

Die Abläufe verwenden die bestehende Phasenanpassung und Überblendung. Geometrie und Lichtverteilung werden gemeinsam übergeben. Wellen und Gruppenwechsel behalten unterstützendes Licht; sie erzeugen selbst keinen vollständigen Blackout. Die Grundgeometrie bleibt beteiligt. Die Auswahl wird je Songplan zwischengespeichert, ohne zusätzliche Renderdurchläufe. Show verwendet weiterhin seine eigene Auswahl.

### Prüfung dieser Ergänzung

- 25 gezielte Tests bestanden: Katalog, musikalische Rollenwahl, Symmetrie, kleine und große Gruppen, Kontinuität, Raumzuordnung sowie tatsächlicher Wechsel der Lampenhelligkeit.
- Gesamtsuite vor dem abschließenden zusätzlichen Lampenhelligkeitstest: 1012 bestanden, ein bestehender LAN-Vorschaufehler (`/dmx-strobe-score.js`, HTTP 403).
- Keine vollständige visuelle Abnahme im Club-Renderer und kein neuer Frametiming-Benchmark. Insbesondere enge Bewegungsbereiche können sichtbare Unterschiede weiterhin verringern.
- Neuladen berechnet die Automatik-Auswahl neu; eine erneute Audioanalyse ist nicht erforderlich.

Gezielte Prüfung: `node --test test/dmx-automatic-sequences.test.mjs test/dmx-automatic-150.test.mjs test/dmx-group-motion.test.mjs test/dmx-song-continuity.test.mjs test/dmx-motion-surface.test.mjs`.
