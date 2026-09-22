Moving-Head-Vorberechnung — 22.09.2026

Pro analysiertem Lied werden bei eingeschalteter Simulation vier Pan-/Tilt-Spuren aus Beat-Raster, Abschnittsrollen und vorhandenen Akzenten vorbereitet. Außenköpfe decken einen breiteren Bereich ab, Innenköpfe bleiben stärker gebündelt. Abschnittswechsel werden bis zu einer Sekunde vorausgeplant, Bewegungsgrenzen sind in die Spuren eingerechnet. Dunkle Songpassagen erlauben die Vorpositionierung; Pause und Vorschau-Blackout halten die Darstellung an.

Die Vorbereitung läuft kooperativ in Paketen von 128 Samples. Standardauflösung: 50 ms, linearer Abruf zwischen Samples. Lange Aufnahmen verwenden ein gröberes Raster, begrenzt auf ungefähr 2 MiB je Variante. Abspielen und Crossfaden lesen die Spuren über die jeweilige Songposition. Eine zusätzliche Begrenzung der sichtbaren Bewegung fängt Tracksprünge ab.

Der Cache gilt für die aktuelle Sitzung und das jeweilige Show-Objekt. Neue/ersetzte Shows werden neu vorbereitet. Ausschalten pausiert ausstehende Arbeit. Nach Neuladen werden vorhandene Songanalysen wiederverwendet, die Bewegungsspuren erneut berechnet. Die Demo ohne Lied verwendet weiterhin die direkte Bewegungssimulation.

Messung auf diesem Rechner mit synthetischen Songdaten, keine Audioanalyse enthalten:

| Songlänge | Reine Berechnung (Node) | Speicher für vier Köpfe |
| --- | ---: | ---: |
| 3 Minuten | 14 ms | 113 KiB |
| 5 Minuten | 15 ms | 188 KiB |
| 10 Minuten | 20 ms | 375 KiB |

Browserprüfung: fünf Minuten Songdaten in 205 ms einschließlich der kooperativen Wartezeiten. Hardware, Browser und Analysedaten beeinflussen die Dauer; dies ist kein Benchmark realer Audiodateien.

Verifiziert mit `node --test test/dmx-moving-plan.test.mjs test/dmx-moving-heads.test.mjs test/dmx-auto.test.mjs test/stage-motifs.test.mjs` und `node scripts/check-dmx-moving-heads.mjs`: deterministische Spuren, Interpolation, Seek-Wiederholung, individuelle Köpfe, Bewegungsgrenzen, Modi, Opt-in, Abbruch/Fortsetzung, Cache-Invalidierung, Fehlerbehandlung, dunkle Vorpositionierung, Pause, Blackout, reduzierte Bewegung sowie Desktop/Mobil-Darstellung. Simulation startet keine Hardware-Ausgabe.
