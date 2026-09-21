# Musikalische Übergänge und automatische Bühnenmotive

Auto-Crossfade und Queue wählen einen lokal stabil erkannten Taktanfang kurz
vor dem bisherigen Zeitlimit; Abschnittsanfänge auf solchen Takten haben
Vorrang. Ohne Raster bleibt der Zeitstart. Die Vorverlegung ist auf vier
Sekunden bzw. die halbe Fade-Dauer begrenzt, berücksichtigt Playback-Rate und
überspringt nicht in die erste Songhälfte. Ein verspätet bereites Zieldeck wird
weiterhin sofort übernommen; ein manueller Übergang startet ebenfalls sofort.
Bei Auto Beat kann ein naher Taktanfang bis zwei Sekunden nach dem Ziel-Cue
verwendet werden. Pause, Abbrechen, manuelle Crossfadersteuerung und Queue-
Sperren behalten ihre bisherigen Mechanismen.

Für die automatische DMX-Bühne werden aus dem vorbereiteten Track Farbanker
pro bereits erkannter Motivgruppe abgeleitet. Wiederholte Motive teilen den
Anker und starten Bewegungen relativ zu ihrem Abschnitt. Bekannte ruhige
Passagen werden gedämpft, Aufbaupassagen steigern sich bis zum bisherigen
Maximum; es wird keine zusätzliche Helligkeit oberhalb der vorhandenen Show
angefordert. Die gemeinsame und manuelle Lichtausgabe bleiben unverändert.
Keine neue Audioanalyse und keine neue externe Abhängigkeit.

Verifikation:
- Vollständige Testsuite: 234 Tests erfolgreich.
- Modelltests: Takt-/Abschnittsvorrang, fehlende/instabile Raster, Playback-Rate,
  kurzer Track, Cue-Begrenzung, wiederkehrende Farben/Bewegung und Helligkeitsgrenzen.
- `node scripts/check-musical-crossfade.mjs`: Browser-Audiotest erfolgreich.
- `node scripts/check-musical-crossfade.mjs --queue`: gleicher Ablauf über Queue.
- Zwei generierte Audiodateien werden tatsächlich abgespielt. Analyseantworten
  sind kontrollierte Testdaten. Bei 13 Sekunden Tracklänge und vier Sekunden
  Fade startete der Übergang um Sekunde 8 statt beim alten Zeitlimit 9 und wurde
  vollständig beendet.
- Web-Build und `git diff --check`: erfolgreich.

Grenzen: Browser-Timer/Audio-Latenzen sind nicht samplegenau. Motividentität
übernimmt die bestehende heuristische Erkennung bzw. KI-Abschnittslabels;
ähnliche Refrains sind keine garantierte semantische Erkennung. Die DMX-Ausgabe
bleibt eine Simulation.
