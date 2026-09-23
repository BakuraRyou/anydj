# Musikalische Lichtpausen

Die Automatik verteilt Licht auf aktive und pausierende Gruppen. Vier Spots
verwenden normalerweise zwei aktive Geräte, in Peaks drei. Nur starke Akzente
öffnen alle vier. Ruhige und atmosphärische Passagen halten ihre Gruppe.
Ausgewählte Analyseereignisse lösen Gruppenwechsel aus, mit 240 ms Überblendung
(120 ms in Peaks). Die Mindestabstände begrenzen nur die Dichte; ohne Ereignis
wird kein Wechsel ausgelöst. Seeking liest dieselbe vorbereitete Ereignisliste.

Spots und Lichtleisten erhalten getrennte Formationen. Beim Deckübergang werden
die Helligkeiten beider Formationen gewichtet gemischt. Die Moving-Head-Vorschau
übernimmt bevorzugt die Spots; auch ohne Geräte erhält sie Lichtpausen.
Explizite Modi wie Lauflicht, Gruppenwechsel und gemeinsame Musikimpulse behalten
ihre eigene Choreografie. Keine erneute Songanalyse nötig.

## Prüfung

407 Node-Tests sowie der Browsercheck für Moving Heads: Lichtpausen mit Spots
und ohne Geräte, Blackout, Stop, Bewegung, Persistenz und responsive Darstellung.

Stichprobe aus dem bereits analysierten `RobbieWilliamsBoddies.mp3`, ausgewertet
in 25-ms-Schritten mit der tatsächlichen Akzenthüllkurve:

| Songabschnitt | Mindestens ein Kopf vollständig aus | Alle vier vollständig aktiv | Dunkelanteil je Kopf |
| --- | ---: | ---: | --- |
| 10–50 s | 85 % | 1 % | 32 / 33 / 32 / 31 % |
| 69,53–84,89 s | 75 % | 1 % | 19 / 19 / 19 / 19 % |
| 184,73–200,09 s | 100 % | 0 % | 100 / 0 / 0 / 100 % |

Die Prozente beschreiben Aktivitätsmasken, nicht gemessene reale Lampenhelligkeit.
Während Überblendungen können kurzzeitig alle Geräte teilweise aktiv sein.
Die ruhige Passage hält das innere Paar; die äußeren Köpfe pausieren.
