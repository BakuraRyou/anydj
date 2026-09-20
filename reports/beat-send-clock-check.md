# Beatgesteuerte Sendetermine

20.09.2026. Rückmeldung: einzelne Stellen wirken passend, häufig stimmt schon
der Rhythmus nicht. Start/Pause reagieren zügig. Die bisherigen Tests belegten
korrekte Werte und Wiedergabesteuerung, aber noch keine musikalische Synchronität.

Weitere Ursache im Code: Musikseite und DJ-Pult fragten den aktuellen Lichtwert
nur alle 100 ms ab. Auch mit exakt berechneter Helligkeit konnte ein kurzer
Beat-Impuls dadurch erst im Abklingen verschickt werden. Die zusätzliche
100-ms-Sendebegrenzung darf nicht durch ein Zwischenbild unmittelbar vor dem
Beat belegt werden.

`show-clock.js` plant deshalb den nächsten Sendetermin anhand der Audiozeit und
der Beatliste. Vor nahen Beats wird das Zwischenbild ausgelassen; der Beat erhält
den nächsten Termin. Die Uhr wartet bei einem zu früh ausgelösten Timer auf die
tatsächliche Audiozeit. Pause, Seek und Stopp verwenden weiterhin die Player-Zeit;
keine aufgelaufene Warteschlange. Das Server-Limit bleibt bei zehn Befehlen pro
Sekunde. Im DJ-Mix können zwei unterschiedliche Beat-Raster weiterhin konkurrieren;
dies ersetzt kein musikalisches Beatmatching der beiden Audiospuren.

Prüfung und Grenzen:
- Diagnose an der vorhandenen Robbie-Williams-Datei: 544 Modell-Beats, medianes
  Tempo 125 BPM; 97,4 % liegen innerhalb 60 ms zum nächsten spektralen Einsatz.
  Diese Einsätze sind keine manuell annotierte Beat-Referenz. Die Analyse verwendet
  ffmpeg, dessen Dekodierungsursprung vom Browser abweichen kann. Daraus folgt keine
  garantierte Erkennungsqualität. Werte in `beat-onset-audit.json`.
- Deterministische Simulation mit diesen 544 Zeitpunkten: feste 100-ms-Abfrage
  verschickt 219 Spitzen mehr als 50 ms spät. Beatgesteuerte Termine liegen in
  dieser idealisierten Simulation höchstens 1 ms spät. Keine Netzwerk-/Hardware-
  oder Echtzeitgarantie. Werte in `beat-send-schedule-audit.json`.
- Tatsächlicher stummer Chrome-Test mit einem vorgegebenen, nicht auf dem
  100-ms-Raster liegenden Beat-Raster: elf gemessene Browser-Anfragen jeweils
  rund 8 ms nach dem Beat. Erfasst wurde Audiozeit beim Absenden, nicht optische
  Lampenantwort. Werte in `show-clock-browser-check.json`.
- Auto-Crossfade und manuelles Übernehmen weiterhin erfolgreich, keine
  Browser-Ausnahmen. 127 Node-Tests erfolgreich, einschließlich 500 Beat-Terminen,
  vorzeitigem Timer und Abbruch.

Für eine Aussage zur verbleibenden musikalischen Abweichung fehlt weiterhin eine
vergleichbare Aufnahme/Beobachtung von Musik und realer Lampe nach dieser Änderung.
