# Beat-Zeitpunkte und Taktakzente

20.09.2026. Rückmeldung: Licht passt musikalisch noch nicht; Start/Pause reagieren
nahezu ohne Verzögerung. Damit ist eine große konstante Steuerverzögerung nicht
belegt. Die Qualität der Beat-Erkennung und die musikalische Wirkung wurden noch
nicht für eine vom Nutzer benannte Stelle verglichen.

Nachgewiesene Implementierungsprobleme:
- Bisher wurde jeder neue Beat auf ein 125-ms-Farbraster gelegt, mit zusätzlichem
  Vorgriff von 40 ms. Die Spitze konnte dadurch bis knapp 40 ms vor oder 85 ms
  nach dem Modellzeitpunkt liegen. Der Decoder-Zeitursprung bleibt unverändert.
- Vorbereitete Browser-Bilder warteten zusätzlich auf den unabhängigen
  125-ms-Servertimer. Das ist von der Reaktionszeit auf Start/Stop zu unterscheiden.
- Erkannte Taktanfänge wurden in der automatischen Helligkeit nicht gewichtet.

Änderungen:
- Planversion 6 speichert Beat-Zeitpunkte und die Helligkeitshüllkurve. Farben
  bleiben im vorhandenen Raster; showFrameAt berechnet die Helligkeit direkt aus
  der aktuellen Audiozeit. Suchen erfolgt binär und zustandslos, auch nach Seek.
- Empfangene Show-Bilder stoßen direkt die Weiterleitung an. Höchstens zehn
  UDP-Befehle pro Sekunde, ein laufender Befehl, keine wachsende Warteschlange.
  Timeout/Backoff und Wiederherstellung bleiben erhalten.
- Automatik mit mindestens zwei Modell-Taktanfängen: Faktor 1 am Taktanfang,
  Faktor 0,7 auf anderen Beats vor Anwendung der Helligkeitskurve. Keine erfundene
  Vierergruppierung. Ohne Taktanfänge sowie im manuellen Modus bleibt Faktor 1.
  Diese Gewichtung ist eine Gestaltungsentscheidung, keine neue Beat-Erkennung.

Prüfung: 124 Tests erfolgreich. Neue Tests treffen nicht rasterförmige Beats bei
0,333 und 0,847 Sekunden exakt, prüfen Taktakzente/Fallback/manuellen Modus sowie
direkte, begrenzte Weiterleitung. Der stumme Chrome-DJ-Test mit Demo-Lampen prüft
weiterhin Crossfade und manuelle Übernahme. Keine Messung der optischen Reaktion
einer echten WiZ-Lampe; Browser-Intervalle und Lampenübergänge bleiben bestehen.
