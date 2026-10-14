# Strobo: musikalische Regie statt wiederholter Beat-Schleifen

## Änderung

Die aktive Ausgabe vorbereiteter Songs verwendet keine wiederholten Acht-Beat-Ereignisfolgen mehr. Sie übernimmt die musikalischen Bilder und deren Rollen aus planShowScore sowie die musikalischen Bewegungsereignisse aus musicalMovementEvents. Die räumliche Übersetzung bleibt Strobo-spezifisch. Automatisch und Show selbst wurden nicht geändert.

- Gemessene Bassattacken und als onset beziehungsweise instrument gekennzeichnete Einsätze führen die Hauptgruppen.
- Qualifizierte Melodieänderungen führen die Antwortgruppen. Erkannte Notenlängen bestimmen deren Leuchtdauer, begrenzt auf 1,8 Sekunden.
- Besondere Akzente und Ausdrucksänderungen stammen aus der gemeinsamen musikalischen Planung.
- Gemessene Tonhöhen- und Klangfarbenverläufe beeinflussen die räumliche Figur zwischen den Einsätzen.
- Die Motorplanung berücksichtigt Ereignisbeginn und Ereignisende und behält ihre bisherigen Geschwindigkeitsgrenzen.
- Ein bloßes Beat-Raster erzeugt keine neue Ereignisfolge. Ohne belastbare Ereignisse bleibt ein reduziertes Klangbild sichtbar. Die alten Musterschleifen bleiben nur für den bisherigen Demo-/Legacy-Pfad ohne vorbereitete musikalische Regie erhalten.
- Stille und explizite Dunkelphasen behalten Vorrang; Ereignisse laufen nicht über das Ende ihres musikalischen Bildes hinaus.

## Prüfung

546 DMX- und Showprofil-Tests bestanden. Neu geprüft:

1. Identische BPM und Beat-Zeitpunkte, andere akustische Einsätze: andere sichtbare Lichtfolgen.
2. Geändertes Beat-Raster bei gleichen akustischen Einsätzen: unveränderte gemessene Einsätze.
3. Beat-Raster ohne akustische Ereignisse: keine erfundene Blinkfolge.
4. Qualifizierte Melodieänderung: Antwortgruppe erscheint am tatsächlichen Noteneinsatz.
5. Andere gemessene Tonhöhe und Klangfarbe: andere räumliche Ausgabe; Wiederanspringen derselben Songstelle bleibt deterministisch.

Der gespeicherte Analyseplan von dmx-test.mp3 liefert für die neue Ausgabe 58 Melodieereignisse, 304 ausgewählte Bassattacken und zehn Ausdrucksänderungen. 285 als beat markierte Arrangement-Einträge werden nicht pauschal in Lichtimpulse übersetzt.

Vollständiger Offline-Durchlauf: 216 Sekunden, 15 Hz, Club-Raum-Preset mit 48 Moving Heads. Details stehen in strobo-song-regie.json.

## Grenzen

Die Gegenversuche bestätigen, dass die Ausgabe nun von mehr als Tempo und Beatphase abhängt. Eine audiovisuelle Qualitätsabnahme im gespeicherten Aufbau des Nutzers ersetzen sie nicht. Die Musikbindung hängt außerdem von den im jeweiligen Songplan tatsächlich verfügbaren Analyseergebnissen ab.

Bei einem laufenden Server ohne automatischen Neustart: Server neu starten und Seite neu laden, damit das neue Modul ausgeliefert wird.
