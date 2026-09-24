# FalKKonE – In the Hall of the Mountain King: ab 1:31

Vollständige lokale Analyse der Referenzdatei aus `/home/erikh/Musik`, Dauer 236,633 Sekunden. Automatische Gestaltung, Minimum 5, Maximum 100, Moving-Mood balanced. Die Befunde dokumentieren den ursprünglichen Plan; die anschließend implementierte Korrektur steht unten.

## Befunde

1. Das Beat-Raster verliert den Anschluss. Vor 1:29 liegen die erkannten Abstände überwiegend bei 0,38–0,44 Sekunden; ab 1:30 bei 0,74–0,78 Sekunden. Nach 93,14 Sekunden folgt der nächste erkannte Beat erst bei 119,84 Sekunden: 26,70 Sekunden ohne Raster. Die Validierung übernimmt die Modellzeitpunkte unverändert; diese Lücke entsteht bereits in der Modell-Ausgabe einschließlich ihrer minimalen Nachverarbeitung, nicht durch die spätere Lichtvalidierung. Der genaue interne Auslöser des Modellfehlers wurde nicht untersucht.
2. Die hohe musikalische Aktivität wird trotzdem erkannt. Abschnitt 92,39–116,30 ist `peak`, mittlere Instrumentenintensität 0,887. Zwischen 93 und 115 Sekunden liegt die mittlere Percussion bei 0,733. Die Stil-Erkennung ist klar Rock, keine fälschliche Ambient-Zuordnung.
3. Die Phrasenklassifikation widerspricht diesen Informationen. Der Abschnitt enthält nur vier ausgewählte Ereignisse (0,167/s), RMS-Kontrast 0,139. Dadurch wird er als `atmospheric` klassifiziert. Alle vier Akzentprofile sind `held`, also unterdrückt. In der Standardbewegung bleibt ab dem Eintritt bei 92,40 Sekunden bis mindestens 125 Sekunden ein neuer Schwenk aus.
4. Die Fixture-Aktivierung behandelt die verbleibende Energiesteigerung im Peak erneut als Aufbau. Bei 94 Sekunden ergeben sich Aktivierungsfaktoren `[0.12,0.12,0.12,0.20]`, bei 98 Sekunden `[0.36,0.12,0.12,1]`, erst gegen 114 Sekunden wieder `[1,1,1,1]`. Das ist eine zusätzliche gestalterische Fehlinterpretation: Der Höhepunkt wird räumlich wieder klein begonnen.

## Aufbau davor

67,84–92,39 Sekunden werden korrekt als `lift` erkannt. Die vier Phrasen haben jedoch keine ausgewählten Akzentereignisse, durchgehend `atmospheric` und Instrumentenführer `other` mit Konfidenz 1. Zwischen 68 und 91 Sekunden ist die mittlere Percussion praktisch null. Die Grundhelligkeit und die Fixture-Aktivierung steigen, eine melodisch getragene Bewegungsentwicklung erhält der Aufbau nicht. Das erklärt seine geringe Abwechslung, ohne dem Stück einen zufälligen Beat unterzulegen.

## Geeignete Korrekturrichtung

- Lange Beat-Ausfälle und plötzlich halbierte Raster als Unsicherheit markieren; nur anhand gemessener Attacken bzw. Instrumentenaktivität ein alternatives lokales Timing verwenden, statt einen unsicheren Takt beliebig fortzuschreiben.
- Fehlendes Raster darf hohe gemessene Percussion nicht automatisch in atmosphärisches Verhalten verwandeln. Musikalischen Charakter unabhängig von der Anzahl bereits ausgewählter Lichtakzente bestimmen.
- Einen erreichten Peak nicht wegen kleiner weiterer Steigerungen erneut auf wenige aktive Köpfe reduzieren.
- Nicht-perkussive Aufbauten über Melodie, Klangverlauf und Phrasenspannung gestalten, ohne künstliche Schläge zu erzeugen.

Die Untersuchung betrifft frisch analysierte lokale Daten. Abweichende Profile oder ältere gespeicherte Pläne können die konkrete Nutzeransicht verändern. Es wurden keine zusätzlichen Browser-Leistungsmessungen durchgeführt; die beschriebenen Widersprüche liegen bereits im vorbereiteten Showplan.


## Implementierte Korrektur und Prüfung

- Bei ungewöhnlich großen Rasterlücken nutzt die Lichtplanung gemessene lokale Maxima der Drum-Spur. Mindestens drei starke Attacken im lokalen Drei-Sekunden-Fenster sind erforderlich; ein einzelner Einsatz oder ein konstanter Drum-Pegel erzeugt keine Ersatzfolge. Bestehende nahe Beat-Ereignisse werden nicht verdoppelt. Das exportierte Beat-Raster wird nicht umgeschrieben.
- Hohe Percussion mit wiederholten Attacken kann eine Phrase unabhängig von ausgewählten Lichtakzenten als rhythmisch kennzeichnen. Ein komprimierter Gesamtpegel muss dafür keinen hohen Lautstärkekontrast zeigen.
- Bereits energetische Peaks beginnen wegen einer weiteren Steigerung keine neue gestaffelte Lampenaktivierung. Echte Entwicklungen aus geringer Energie sowie Rücknahmen bleiben möglich.
- Gemessene Intensitätssteigerungen in Aufbauten können eigene Bewegungsziele auslösen, ohne zusätzliche Helligkeitsakzente zu erzeugen.

Neukompilation derselben lokalen Analyse: Alle drei Phrasen von 92,39 bis 116,30 Sekunden sind rhythmisch. Zwischen 93,14 und 115,30 Sekunden entstehen 23 Groove-Bewegungsziele statt des früheren Stillstands. Bei 94, 98 und 105 Sekunden betragen die Aktivierungsfaktoren jeweils `[1,1,1,1]`. Der Aufbau davor erhält zwei zusätzliche, aus der Steigerung abgeleitete Bewegungen bei 70,84 und 83,24 Sekunden.

Validierung: 447 automatisierte Tests bestanden, einschließlich vier neuer Regressionstests für Rhythmusausfälle, stabile Spuren, Peak-Aktivierung und nicht-perkussive Aufbauten. Die vorhandene Chrome-Prüfung für Moving Heads einschließlich Blackout, Stop, Persistenz, reduzierter Bewegung und responsiver Darstellung besteht; die kooperative Vorbereitung eines synthetischen Fünf-Minuten-Stücks dauerte 213 ms.

Zusätzlich wurde die tatsächliche Bewegung des korrigierten Referenzplans zwischen 67 und 120 Sekunden in 1-ms-Schritten geprüft. Maxima für Pan: 61,87 Grad/s, 197,05 Grad/s² und 2733,63 Grad/s³; für die normierte Tilt-Achse: 0,236/s, 0,907/s² und 11,640/s³. Alle liegen innerhalb der unveränderten Modellgrenzen. Das ist eine Prüfung des Bewegungsmodells, keine Messung realer Motoren.

Die Ausweichsteuerung verwendet Instrumenten-Hüllkurven mit 100-ms-Auflösung. Sie repariert nicht grundsätzlich BPM oder Downbeat-Erkennung des Analysemodells. Es gibt keine Sonderbehandlung des Dateinamens. Showplan-Version 26 verwirft ältere vorbereitete Lichtpläne bei der nächsten Vorbereitung; dafür die Anwendung neu laden und den Titel erneut vorbereiten.
