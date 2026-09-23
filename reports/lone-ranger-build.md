# The Lone Ranger: Aufbau ab 1:30

Referenz: lokale `NWYR, W&W - The Lone Ranger.mp3`, 156,011 Sekunden. Frische CPU-Analyse mit vorhandenen Beat-, Stil-, Struktur- und Instrumentenmodellen. Automatische Gestaltung, Mindesthelligkeit 5, Maximum 100.

## Ursache

Die Analyse behandelte 86,80–101,57 Sekunden vollständig als Ruhephase (`held`), ohne ausgewählte Lichtakzente. Hier steigt die Spannung nicht durch Lautstärke: Von 90–92 bis 96–98 Sekunden sinkt das mittlere RMS von 0,290 auf 0,259, während Klanghelligkeit von 0,683 auf 0,751 und spektrale Flachheit von 0,333 auf 0,420 steigen. Die energiebezogene Aufbau-Erkennung übersah diesen Filter-/Rauschverlauf.

## Änderung

Zusätzliche, konservative spektrale Aufbau-Erkennung innerhalb vorhandener Abschnitte von 8–32 Sekunden:

- Klanghelligkeit, spektrale Flachheit und obere spektrale Grenze müssen gemeinsam über mehrere Sekunden steigen.
- Mindestens drei messbare Steigerungsschritte und ein überwiegend gerichteter Verlauf; ein einzelner Sprung reicht nicht.
- Der folgende Abschnitt muss nachweislich mehr Gesamt- und Bassenergie haben. Stille, gleichbleibende helle Flächen und bloßes Ausblenden reichen nicht.
- Die kurze Rücknahme vor dem Einsatz bleibt ein eigener Abschnitt.

Für die Referenz entsteht ein Aufbau von 86,80 bis 97,80 Sekunden. Dessen gemessene spektrale Kurve steuert Grundhelligkeit und schrittweise Fixture-Aktivierung. Es werden keine zusätzlichen Beat-Blitze erfunden. Diese Änderung ergänzt die energetischen Aufbauten; keine titelabhängigen Zeitmarken.

## Ausgabe

Einzelne Messpunkte der berechneten Show-Helligkeit (Prozent):

| Zeit | Vorher | Nachher |
| --- | ---: | ---: |
| 1:30 | 18 | 26 |
| 1:32 | 17 | 28 |
| 1:34 | 17 | 28 |
| 1:36 | 17 | 32 |
| 1:40 | 15 | 16 |
| 1:42 | 32 | 32 |

Die Grundhelligkeit hält auf einem gemessenen Plateau. Vor dem Einsatz wird sie wieder zurückgenommen. Nach `automaticStage → encodeStage → decodeStage` liegen die maximalen RGB-Komponenten der vier Spots bei 1:36 statt `[22,22,22,22]` bei `[76,76,46,76]` (0–255). Das beschreibt die simulierte Ausgabe, keine gemessene reale Lichtleistung.

## Prüfung

Vollständige Suite: 430 Tests erfolgreich; anschließend zusätzlicher Compiler-Integrationstest erfolgreich (jetzt 431 Tests im Bestand). Drei neue Tests decken Aufbau trotz sinkender Lautstärke, negative Gegenbeispiele, Fixture-Aktivierung, Rücknahme und deterministische Wiedergabe nach Suchen ab. Browsercheck erfolgreich. Auf den vorhandenen Referenzanalysen Shades und Lies Irae werden keine zusätzlichen spektralen Aufbauten erkannt.

Show-Plan-Version auf 24 erhöht. Anwendung neu laden und Track erneut vorbereiten lassen, damit die neue Analyse in den Showplan einfließt. Die Erkennung ist auf die geprüften Merkmale begrenzt und erkennt damit nicht jeden denkbaren musikalischen Spannungsaufbau.
