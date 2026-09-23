# Farbverteilung der virtuellen Moving Heads

Die ausgewogene Zwei-Farben-Zuordnung der Automatik allein verhinderte nicht jede 3:1-Verteilung. Die vier virtuellen Köpfe übernahmen anschließend Farben aus der eingetragenen Ausstattung. Bei drei oder fünf Spots wurden dabei wiederholt Farben ausgewählt, sodass unter anderem `[A,A,B,A]` entstand.

Die Browser-Reproduktion zeigte vor der Korrektur für drei Spots über vier musikalische Layouts: `[A,B,A,A]`, `[A,A,B,A]`, `[A,B,A,A]`, `[A,A,A,B]`. Bei fünf Spots traten ebenfalls zwei Dreiergruppen auf.

Wenn die Farbquelle von vier Zellen abweicht, berechnet die automatische Vorschau jetzt eine eigene Vierer-Anordnung aus denselben Musikquellen, der eingestellten Farbanzahl und derselben globalen Farbkorrektur. Auch ihre Helligkeit und gezielten Lichtpausen beziehen sich dadurch auf vier Köpfe. Die Ausgabe an die eingetragenen echten Geräte bleibt unverändert. Vier vorhandene Spotfarben werden weiterhin direkt übernommen; explizite andere Lichtmodi behalten ihre Ausgabe.

Prüfung: 428 Node-Tests erfolgreich. Browsercheck prüft die tatsächlichen CSS-Strahlfarben nach DMX-Kodierung/Dekodierung bei 2, 3, 4, 5, 6, 7 und 8 Spots sowie reinen Lichtleisten mit 7 und 8 Zellen. Die vier musikalischen Farbzuordnungen sind jetzt überall `[A,B,A,B]`, `[A,A,B,B]`, `[A,B,B,A]`, `[A,B,A,B]`. Bestehende Browserprüfungen für Lichtpausen, Blackout, Bewegung und Bedienung bestehen ebenfalls.

Die Änderung betrifft die Wiedergabe. Anwendung neu laden; keine neue Songanalyse erforderlich. Die genaue gespeicherte Ausstattung des Nutzers lag bei der Reproduktion nicht vor.
