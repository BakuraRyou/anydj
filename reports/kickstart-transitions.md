# Kickstart My Heart: auffällige Automatikübergänge

Referenz: lokale Datei `Mötley Crüe - Kickstart My Heart (Official Music Video).mp3`, Dauer 312,6567 s. Frische vollständige Beat-, Stil-, Struktur- und Instrumentenanalyse. Zeitangaben beziehen sich auf diese Datei. Plan und Cue-/Belichtungsfunktionen wurden direkt ausgewertet. Keine auditive Abnahme, kein Videovergleich und kein Nachbau gespeicherter Browser-Overrides.

## Bestätigter Mechanismus

`automaticSceneCues` in `public/dmx-moving-cues.js` setzt für einen Szeneneinstieg `darkTravel`, wenn der Abstand der vier Quellposen über 18 liegt und der lokale Antrieb unter 0,45 liegt. Diese Entscheidung prüft keine musikalische Pause. `movingCueExposure` blendet vor der Fahrt in 0,18 s aus, hält während der Fahrt dunkel und blendet danach in 0,3 s ein.

Die Gruppenbewegung und Raumabbildung können die endgültigen Ziele bereits kontinuierlich erzeugen. Der Shutter der Quellbewegung bleibt aber wirksam. Im untersuchten Plan ergeben sich dadurch komplette Abdunklungen trotz positiver Quellhelligkeit und positiver Gruppenpräsenz.

## Vorrangige Kandidaten

| Cue-Zeit | Gesamtes Aus-/Einblendfenster | Bewegung | Helligkeitsvorgabe in der dunklen Fahrt |
| --- | --- | --- | --- |
| 2:22,39 | 2:21,19–2:22,69 | atmender Bogen → Rahmen | 34; Gruppenpräsenz 0,55 |
| 2:49,86 | 2:48,81–2:50,16 | schwenkende Linien → Rahmen | 45; Gruppenpräsenz 0,75 |
| 4:07,60 | 4:06,53–4:07,90 | Lichtvorhang → Rahmen | 44; Gruppenpräsenz 0,75 |
| 4:13,28 | 4:12,78–4:13,58 | Rahmen → gleicher Rahmen | 61; Gruppenpräsenz 0,55 |

Der letzte Fall zeigt besonders deutlich: Eine unveränderte Gruppenformation kann dennoch vom darunterliegenden Positionswechsel dunkel geschaltet werden. Das ist keine Feststellung, dass an diesen Stellen musikalisch niemals ein Schnitt sinnvoll wäre; nachgewiesen ist die geometrische statt musikalische Ursache dieser Shutterentscheidung.

Weitere darkTravel-Einstiege: 0:28,18; 0:36,88; 3:11,20; 3:29,39; 5:06,59. Dort wechseln auch gehaltene/aktive Zustände; diese benötigen gesonderte Bewertung und sollten nicht pauschal entfernt werden.

## Andere untersuchte Mechanismen

Der vollständige Plan enthält bei 0:50,52 eine bewusst kurze 0,7-s-Überblendung mit Energieanstieg ca. 0,278 und Übergangsevidenz 0,793. Das ist ein anderer Fall als die obigen unbegründeten Quell-Shutter.

In der vorläufigen Analyse verkürzt die Viertel-Dauer-Begrenzung einige geplante 1,8-s-Übergänge auf 0,5 s. Die entsprechenden kurzen Zwischenpassagen bestehen im vollständigen Plan nicht mehr. Dieser Befund wird deshalb nicht als Hauptursache der konkreten vollständigen Show gewertet. Die bei aktiven Gruppenwechseln gemessenen unmittelbaren Positionsdifferenzen sind klein; es liegt dort kein offensichtlicher teleportierender Zielpunkt vor.

## Gezielte nächste Korrektur

Quellpose-bedingte Dunkelfahrten bei einer kontinuierlich aktiven Gruppenübernahme dürfen die Raumchoreografie nicht unabhängig unterbrechen. Musikalische Blackouts, manuelle Shutter, tatsächliche Ruhezonenfahrten und nötige Dunkelfahrten physischer Geräte müssen ihre Wirkung behalten. Deshalb keine globale Entfernung von `darkTravel`, sondern Entscheidung auf der tatsächlich verwendeten Bewegungsebene.

In dieser Diagnose wurden keine Laufzeitänderungen vorgenommen.

## Vorher-/Nachher-Experiment

Die vier geometrischen Dunkelfahrten wurden in einer isolierten Offline-Variante nur dann unterdrückt, wenn der Gruppenplan vom Beginn der Ausblendung bis zum Ende der Einblendung lückenlos aktive Bewegungen enthält. Das wählte genau die vier oben genannten Kandidaten aus. Andere Dunkelfahrten blieben erhalten. Die Produktivdateien wurden dafür nicht geändert.

Vergleich: identischer vorbereiteter Songplan, Club-Preset mit 48 Moving Heads, 30 Hz; beide Simulationen starten bei Songzeit 0, Messfenster 140–255 s. Raumabbildung, Ruhezonen, Motoren, Quellfarben, musikalische Helligkeit und Gruppenpräsenz waren aktiv.

| Cue | Vollständig dunkle Moving Lights vorher | Nachher |
| --- | ---: | ---: |
| 2:22,39 | 1,00 s | 0 s |
| 2:49,86 | 0,87 s | 0 s |
| 4:07,60 | 0,90 s | 0 s |
| 4:13,28 | 0,33 s | 0 s |

„Vollständig dunkel“ bedeutet Summe aller 48 berechneten Moving-Light-Leistungen unter 0,001; statische Lampen sind nicht Teil dieser Aussage. Zeiten sind auf 1/30 s aufgelöst. Die maximalen Winkel- und Zielpunktänderungen in jedem Vergleichsfenster sind identisch. Außerhalb der Fenster einschließlich zwei Sekunden Nachlauf sind bei 3065 Samples alle Helligkeiten und Zielpunkte exakt gleich. Auch die maximalen Bewegungswerte des gesamten Messfensters sind identisch.

Ergebnis: Eine merkbare Verringerung des Schnitt-Eindrucks ist gut begründet: ganze Gruppen verschwinden nicht mehr für bis zu eine Sekunde, während ihre vorhandene Bewegungsbahn sichtbar weiterläuft. Die musikalische und visuelle Live-Abnahme bleibt offen. Das Experiment prüft keine physischen DMX-Geräte und keine GPU-Performance. Vor einer Produktivintegration muss die Unterscheidung zwischen Quellposen und tatsächlich verwendeter Raumchoreografie erhalten bleiben; geometrische Dunkelfahrten dürfen nicht global entfallen.

Messwerte: `reports/kickstart-transition-comparison.json`.

## Produktivintegration

Die Korrektur ist jetzt eingebaut. Automatische Quellcues erhalten eine zusätzliche Kennzeichnung, wenn die Gruppenbewegung das gesamte Aus-/Einblendfenster lückenlos abdeckt. Manuelle Rhythmuswahl und Bewegungshalte schließen diese Freigabe aus. Die normale Quellbelichtung bleibt erhalten; eine zweite Belichtung wird ausschließlich für die tatsächlich eingesetzte automatische Raumgruppenbewegung berechnet. Bei nur teilweiser Übernahme der Gruppenpose wird auch die Freigabe anteilig überblendet. Andere Modi und ungekennzeichnete Dunkelfahrten bleiben unverändert.

Die Anpassung erfolgt vor Ruhezonen- und Motorverarbeitung. Quell-Blackouts, Nullpegel und die nachgelagerten räumlichen Sperren bleiben wirksam. `scripts/review-show-visibility.mjs` bildet denselben Pfad ab.

Produktivpfad erneut auf Kickstart My Heart, 140–255 s, 48 Moving Heads, 30 Hz verglichen: **3451 Frames, maximale Leistungs- und Zielpunktabweichung gegenüber dem erfolgreichen Experiment jeweils 0**. Gesamte Testsuite: **890 bestanden**. Neue Tests in `test/dmx-group-shutter.test.mjs`. Visuelle Live-Abnahme und physische DMX-Prüfung bleiben offen.

Die Cue-Vorbereitung wird beim Neuladen neu aufgebaut; eine erneute Audioanalyse ist für diese Änderung nicht erforderlich.
