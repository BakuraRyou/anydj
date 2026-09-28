# Reproduktion: abrupte Dunkelphase am Ende der Aufnahme 17.47

Die neue Aufnahme dauert 8,067 s. Ihre Tonspur stimmt mit Atomic Damage ab Songsekunde 103,109 überein (Mono 2 kHz, normierte Korrelation 0,99290). Der sichtbare Abbruch gegen Videoende fällt auf die im Nutzerexport erkannte Instrumentenruhe ab 110,10 s.

## Reproduzierter Fehler

`activityAt` blendet diese Instrumentenruhe über 0,6 s aus. Gleichzeitig schaltet `movingPresenceAt` auf ein Showbild mit `occupancy: 0`. Damit überspringt die sichtbare Moving-Head-Formation die vorgesehene Ausblendkurve und verschwindet sofort. Beispielsweise liefert die musikalische Helligkeitskurve bei 110,20 s noch 0,926, die Moving-Head-Auswahl davor aber bereits 0.

## Korrektur

Während einer tatsächlich gemessenen Ruhephase bleiben die Mitglieder der ausgehenden Formation ausgewählt. Die bestehende gemeinsame Ausblendkurve bestimmt ihre Leistung. Reihen und Paare wechseln dabei nicht. Nach dem Ausblenden sind sie vollständig aus. Explizite leere Bilder ohne gemessene Ausblendung bleiben leer. Kurze gemessene Blackouts behalten ihre vorhandene 0,06-s-Kurve.

Keine Änderung an Quellenhelligkeit, Farben, Ruhephasenerkennung oder allgemeinen Helligkeitsreglern. Keine neue Analyse erforderlich; die Änderung betrifft die Wiedergabe bestehender Pläne.

## Prüfung

- Nutzerexport `__mock/anydj-light-review (1).json`: relative Moving-Head-Leistung bei 110,101 / 110,20 / 110,40 / 110,701 s nach Korrektur: 0,999992 / 0,925926 / 0,5 / 0.
- Offline-Replay des Clubraums mit 48 Moving Heads, 30 Hz, 109,8–111,2 s: kein erneutes Einschalten während der Ausblendung, maximale Zielbewegung pro Frame 0,00462 Raumeinheiten.
- Regressionstests prüfen die reale räumliche Auswahl einschließlich Reihen, lange Ruhephase, kurzen Blackout und explizit leeres Bild.
- 906 Tests bestanden.

Damit ist der Abschaltmechanismus dieser neuen Aufnahme reproduziert und korrigiert. Eine visuelle Nachprüfung in der laufenden Sitzung steht aus. Die frühere Aufnahme bei etwa Songsekunde 91 ist damit nicht automatisch erklärt.
