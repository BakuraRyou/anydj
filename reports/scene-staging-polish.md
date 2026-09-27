# Lichtshow: sechs Verbesserungen der Gesamtwirkung

## Umgesetzt

| Bereich | Verhalten |
| --- | --- |
| Hauptfigur | Innerhalb der ohnehin belegten Reihen führt eine Gruppe mit voller vorgesehener Lichtstärke. Begleitung liegt regulär bei 84 %, bei Aufbauten bei 90 %, in intensiven Passagen bei 92 % und an Höhepunkten bei 96 %. Die Gewichtung wird bei Formwechseln überblendet. Kleine Rigs und nur eine aktive Reihe bekommen keine zusätzliche Absenkung. |
| Übergänge | Vor der Wiedergabe wird für jeden geeigneten Wechsel aus 16 Startphasen gewählt. Zielnähe und Bewegungsrichtung gehen gemeinsam in die Bewertung ein. Die bestehende Überblendung und die begrenzte Motorbeschleunigung bleiben bestehen. Gerichtete Aufbauten werden nicht durch Phasenverschiebung verändert. |
| Räumliche Wirkung | Erst nach Raum-, Zonen- und Motorberechnung werden überlappende Auftreffpunkte geprüft. Begleitstrahlen treten bei Überlagerung mit der Hauptfigur etwas zurück (höchstens weitere 18 %). Ziele und geschützte Bereiche werden dabei nicht verändert. |
| Höhepunkte | Raumöffnung wird im Kontext der Energieverteilung des ganzen Liedes geplant. Nur bei deutlichem Kontrast wird volle Ausdehnung als Höhepunkt reserviert. Ein gleichmäßig lautes Lied bekommt keinen künstlichen Höhepunkt. |
| Wiederkehrende Songteile | Vorhandene Strukturabschnitte wie Refrain und Strophe ergänzen die Motiverkennung. Passende wiederkehrende Figuren erhalten kleine Breitenvarianten (maximal 4 %) statt unbedingter identischer Wiederholung. Musikalische Eignung und bisherige Einsatzdauer begrenzen die Wiederaufnahme. |
| Helligkeitsverteilung | Stark überlagerte Empfangsflächen werden weich begrenzt, maximal auf 55 % ihres einzelnen Oberflächenbeitrags. Diese Begrenzung verändert weder Linsenhelligkeit noch den Volumenstrahl. Die separate Begleitgruppen-Regel wirkt hingegen auf deren Lichtstärke. |

Die Regeln für Begleitung und Flächen greifen in Automatik und Show. Party
bekommt diese zusätzliche Raumkorrektur nicht. Blackouts bleiben ausgeschaltet;
eine Begleitgruppe wird nicht zum Ausgleich eines Blackouts hochgeregelt.

## Technische Grenzen

Die Übergangssuche verwendet repräsentative Gruppen in normalisierten
Koordinaten. Sie optimiert nicht für jede reale Geräteposition; danach gelten
weiterhin die Raumregeln und begrenzten Motorbewegungen. Die gewählte Phase
wird pro Plan berechnet und gecacht, nicht pro Bild oder Gerät neu gesucht.

Die Überlagerungsprüfung verwendet weiche, begrenzte Näherungen der Fußabdrücke
auf derselben Fläche. Sie ist keine photometrische Simulation und keine
Auswertung des Kamerabildes. Wand, Boden und Decke werden getrennt behandelt.
Es entstehen keine neuen Shader, Lichtquellen oder Shadow Maps.

## Verifikation

- 873 Tests erfolgreich, einschließlich Modul-Laden in Desktop und LAN-VR,
  gemeinsamer Rendering-Geometrie, Blackouts, begrenzter Helligkeit,
  Wiederholungen, deterministischer Übergangssuche und symmetrischer
  Gruppenwirkung mit Ruhezonen.
- Ein bestehender Raumimport-Test zählte auch neu hinzugefügte Markenrechtecke
  als Raumflächen. Er prüft jetzt gezielt alle importierten Dreiecke und
  weiterhin die vollständige Ausblendung in AR.
- Offline-Wiedergaben im Club-Preset mit 48 Moving Heads: „This Feeling“,
  104–125 s in Automatik, und „Shades“, 36–45 s in Show.
- Die normalisierte Übergangsbewertung verbessert sich bei 15/15 geeigneten
  Übergängen in „This Feeling“ und 13/14 in „Shades“. Kein bewerteter Wechsel
  wird gegenüber Startphase null verschlechtert. Das ist eine technische
  Bewertungsfunktion, keine visuelle Qualitätsmessung.
- Mikrobenchmark nur für die zusätzliche Überlagerungsprüfung, 192 Moving
  Heads, 30 Aufwärm- und 120 Messdurchläufe: verteilt Median 0,56 ms / P95
  0,65 ms; alle auf einen Punkt Median 0,82 ms / P95 0,98 ms. Hardwareabhängig,
  keine Aussage über die gesamte Render-Bildrate.

Die Offline-Spuren protokollieren jetzt pro Kopf auch Führungsgewicht,
Begleitgewicht, Oberflächenbegrenzung und geschätzte Überlagerung:

```sh
node scripts/review-show-visibility.mjs plan.json trace.json 104 125 auto
```

Keine visuelle Browser-Abnahme durchgeführt. Gespeicherte Bedienwerte und
GPU-Rendering sind in diesen Offline-Wiedergaben nicht nachgebildet.
Show-Cache-Version 44, Bewegungsplan-Version 9.
