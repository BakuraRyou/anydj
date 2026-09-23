# Shades: Aufbau von 2:00 bis 2:17

Referenz: lokale `Shades.mp3`, 204,460 Sekunden. Frische CPU-Analyse mit den vorhandenen Beat-, Stil-, Struktur- und Instrumentenmodellen; automatische Gestaltung, Mindesthelligkeit 5, Maximum 100.

## Ursache und Änderung

Der Abschnitt 125,67–140,67 Sekunden wurde wegen seiner durchschnittlichen Instrumentenintensität unter 0,25 vollständig als `held` behandelt. Der spätere rhythmische Aufbau ab 133,18 Sekunden verlor dadurch fast sämtliche Akzente und wurde als atmosphärisch eingeordnet.

Die Abschnittserkennung berücksichtigt nun zuerst eine anhaltende Steigerung: mindestens vier Sekunden Abschnittslänge, Mittelwert der letzten 20 Prozent (maximal drei Sekunden) mindestens 0,25 und mindestens 0,20 höher als am Anfang. Ein leiser Anfang kann diesen Aufbau nicht mehr über den Abschnittsdurchschnitt unterdrücken. Die bisherigen Regeln bleiben als Rückfall erhalten. Keine titel- oder zeitabhängige Sonderregel.

Damit wird der Abschnitt als `lift` erkannt. Die erste Phrase bleibt atmosphärisch; ab 133,18 Sekunden wird sie rhythmisch. Weiche Grundimpulse und hervorgehobene eindeutige Akzente bleiben bestehen. Es wurden weder die Bewegungsgrenzen noch die Palettenparameter geändert.

## Vergleich

Berechnete Show-Helligkeit in Prozent, einzelne Zeitpunkte (keine zeitlichen Mittelwerte):

| Zeit | Vorher | Nachher |
| --- | ---: | ---: |
| 2:00 | 18 | 18 |
| 2:04 | 14 | 14 |
| 2:08 | 17 | 20 |
| 2:12 | 15 | 23 |
| 2:14 | 25 | 40 |
| 2:16 | 19 | 42 |
| 2:17 | 20 | 38 |

Auch nach `automaticStage → encodeStage → decodeStage` kommt die Änderung an: Maximale RGB-Komponente je Spot bei 2:16 vorher `[0,22,24,24]`, nachher `[0,83,92,92]` (0–255). Diese Werte enthalten Abschnittsfaktor und gezielte Fixture-Aktivierung; sie sind keine Messung realer Lichtleistung.

## Prüfung und Aktualisierung

427 Tests erfolgreich. Neuer Regressionstest deckt einen leisen, anhaltenden Aufbau sowie konstante Flächen, wechselnde Energie und einen einzelnen Endschlag ab. Ein kontinuierlicher Aufbau ohne akustische Attacken erzeugt keine erfundenen Rhythmusereignisse. Browsercheck der Moving Heads erfolgreich. Die frühere Referenz Lies Irae bleibt im Übergang als `lift` eingestuft.

Show-Plan-Version auf 23 erhöht: Nach Neuladen der Anwendung werden alte gespeicherte Shows beim nächsten Vorbereiten neu berechnet. Bei bereits geladenen Decks reicht das Fortsetzen der Wiedergabe nicht. Der subjektive Eindruck an der konkreten Anlage muss anschließend beim Anhören geprüft werden.
