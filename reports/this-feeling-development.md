# Automatik: Entwicklung in reduzierten Passagen

Referenz: `anydj_preview_epic-2026-09-27_00.59.mp4`, Deck B,
„This Feeling (Radio Edit)“, ca. 1:42–2:08.

## Ursache

Die vollständige neue Audioanalyse (einschließlich Struktur und Instrumenten)
ordnet die Passage ca. 1:46–2:04 als `sculpture` ein: Energie ca. 0,26–0,29,
rhythmischer Antrieb ca. 0,26, ursprünglicher Look `flow`. Bisher schaltete
jede `sculpture` die Gruppenbewegung aus. Die ruhige Gestaltung wurde damit
zu einer weitgehend stehenden Formation, obwohl musikalische Aktivität vorlag.

Zusätzlich war bei `curtain` und `traveling-group` die Tiefe der Bewegung an
den Reihenabstand gekoppelt. Mehr Reihen verkleinerten dadurch die Bewegung.

## Änderung

- Analysierte, aktive `flow`-/`lift`-/`peak`-Passagen dürfen auch bei reduzierter
  Energie eine zurückhaltende Gruppenbewegung entwickeln. Voraussetzung sind
  Analyse-Evidenz, Energie mindestens 0,18 und Antrieb mindestens 0,15.
- Die Auswahl bleibt auf Lichtlinie, Rahmen und atmenden Bogen begrenzt.
  Diese Entwicklung folgt dem Verlauf der Passage ohne zusätzliche Rotation
  aus dem Beat-Raster. Stille, fehlende Analyse und gehaltene Looks bleiben ausgenommen.
- Linie, wandernde Gruppe und Rahmen öffnen sich paarweise und bewegen sich
  gemeinsam in die Tiefe. Der Bewegungsumfang schrumpft nicht mehr mit dem
  Reihenabstand; erlaubte Zielflächen und Raumbegrenzungen gelten weiterhin.
- Show-Cache-Version 41, Bewegungsplan-Version 6.

## Prüfung

852 Tests erfolgreich, darunter neue Regressionen für reduzierte aktive
Passagen, echte Ruhefälle, manuelle Bewegungshalte, dichte Rigs, kleine
Zielflächen, paarweise Symmetrie und kontinuierliche Bahnen.

Mit dem neu berechneten Bewegungsplan verwendet die konkrete Passage einen
sich langsam entwickelnden Rahmen. Offline-Wiedergabe von 104–125 s im
Club-Preset mit 48 Moving Heads bei 30 Hz über Quelle, Belichtung,
Raumzuordnung, Zonen und Motoren durchgeführt:

```sh
node scripts/review-show-visibility.mjs plan.json /tmp/trace.json 104 125 auto
```

Die Katalogbahnen wurden aktualisiert. Offline-Messungen sind keine visuelle
Abnahme des Browsers: gespeicherte Bedienwerte und GPU-Rendering sind darin
nicht enthalten. Die Schwellen sind allgemeine Regeln, keine Song-Sonderfälle.
