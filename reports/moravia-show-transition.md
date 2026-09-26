# Spirit of Moravia: Show-Anfang bei 6–8 Sekunden

## Reproduktion

Lokale Datei `/home/erikh/Musik/Thomas Bergersen - Spirit of Moravia.mp3`, Dauer 110,377 s. Frische FFmpeg-, Beat-, Stil- und Struktur-/Instrumentenanalyse mit den installierten Modellen und dem aktuellen Show-Worker. Keine gespeicherten Nutzeredits. Die Basisanalyse und die nachgereichte Instrumentenanalyse wurden getrennt geprüft. Offline-Raumwiedergabe im Preset „Club-Bühne · Publikum & Hintergrund“, von Sekunde 0 bis 10 mit 60 Schritten/s. Dabei vereinfachte gemeinsame Quellfarbe/-leistung; keine visuelle Abnahme der laufenden Nutzersitzung.

## Befunde und Korrektur

- Basisanalyse: Bei 6 s wurde ein Bogen durch ein Parallelbild ersetzt, obwohl die Passage keinen rhythmischen Antrieb hat. Die gepaarte Variante dieses Parallelbilds wechselte anschließend die Seiten: außen links von +7,39° am Cue 6 s zu −7,39° am Cue 8,5 s. Das ist eine echte Gegenbewegung im Quellplan, kein ausschließliches Ruhezonenproblem.
- Die detaillierte Analyse hat bei 7,7 s eine Abschnittsgrenze innerhalb eines anhaltenden Klangbilds. Auch ein beibehaltener Bogen begann seine Öffnung an dieser Grenze wieder von vorn.
- Die Show-Cues packten fließende Änderungen häufig in 1,1 Sekunden am Intervallende; davor standen die Köpfe.

Ruhige, nicht rhythmische Flow-Passagen wählen jetzt zusammenhängende, langsam entwickelte Bilder aus Bogen/Fächer/Staffelung. Bei moderaten musikalischen Änderungen bleibt das Bild bestehen. Benachbarte ruhige Passagen derselben Form und Richtung teilen einen Entwicklungszeitraum, ohne die Musikabschnitte oder Farbplanung zusammenzulegen. Fließende Motorfahrten nutzen die verfügbare Zeit unter Beachtung manueller Halte. Gepaarte Parallelbilder behalten ihre Seiten; absichtliche Kreuzfiguren bleiben eigene Formen.

## Kontrolle mit detaillierter Analyse

Das Bogenbild entwickelt sich jetzt über 0,44–14,7 s, einschließlich der Grenze bei 7,7 s. Die äußere linke Quellposition setzt die Öffnung fort:

| Cue | Pan | Tilt |
| --- | ---: | ---: |
| 3,82 s | −13,46° | 0,704 |
| 6,54 s | −14,81° | 0,715 |
| 7,70 s | −15,58° | 0,721 |
| 10,25 s | −17,07° | 0,733 |

Tilt ist der interne normierte Steuerwert, kein Winkel in Grad. Die Werte belegen die fortgesetzte Quellbewegung; sie sind keine gemessenen Hardwarepositionen.

846 Tests erfolgreich. Neue Regressionen prüfen das Fortführen einer ruhigen Orchesterbewegung über Analysegrenzen, die Zeitverteilung der Motorfahrten und den ausbleibenden Seitenwechsel gepaarter Parallelbilder. Cache-Version 39, Show-Score-Version 8.
