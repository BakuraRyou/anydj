# Prüfung des betroffenen Titels

Datei: Run ma de Düdüdüdü Extended (Edit).mp3, lokal aus dem Musikordner.

- MP3: 322,842 Sekunden, 48 kHz Stereo, etwa 7,3 MB; vollständig mit FFmpeg dekodiert.
- Beat This!: erfolgreich, 13,5 Sekunden.
- Stilanalyse: erfolgreich, 2,8 Sekunden.
- Songaufbau mit bisherigem Limit: nach 180,1 Sekunden abgebrochen.
- Songaufbau mit verlängertem Limit: erfolgreich nach 239,034 Sekunden;
  14 Abschnitte und Instrumentendaten. Ergebnis mit validateStructure geprüft.
- 8 Regressionstests für Browser-/Serverbudget, Abbruch und Fehlerbehandlung bestanden.
- Web-Build und git diff --check erfolgreich.

Die Modellprüfung verwendete lokal dekodierte PCM-Daten, keinen vollständigen
Browserdurchlauf. Das DJ-Pult nutzt nun standardmäßig die doppelte Songdauer,
mindestens 60 Sekunden und höchstens 15 Minuten. Explizit kürzere Aufruferbudgets
bleiben erhalten. Gespeicherte Fehlversuche müssen über „Analyse erneut starten“
neu berechnet werden. Kein Deployment oder Neustart des laufenden Benutzerservers.
