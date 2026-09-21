# DJ-Evaluation und Umsetzung

20.09.2026. Ziel ist ein verständliches Zwei-Deck-Pult mit zentralem Mixer.
Die Bewertung beschreibt funktionale Anforderungen aus DJ-Sicht; sie ersetzt
keinen Nutzertest mit auftretenden DJs oder einen Hardware-Dauertest.

| Beim Auflegen benötigt | Umsetzung |
| --- | --- |
| Decks räumlich eindeutig mischen | A links, Bühne/Mixer mittig, B rechts; passende DOM-/Tastaturreihenfolge |
| Einsatzstellen sehen und wiederfinden | Audio-Wellenform, Restzeit, vier gespeicherte Hotcues |
| Beats manuell angleichen | Tempo, Tonhöhen-Erhalt und ausdrücklich ausgelöstes Sync |
| Übergänge verlängern oder Passagen überspringen | Beat-Loops, phasenerhaltende Vier-Beat-Sprünge |
| Bassüberlagerungen und Lautstärkesprünge kontrollieren | Dreiband-EQ, Gain, Kanal- und Masterpegel, Master-Regler, Kompressor |
| Nächsten Track unabhängig vorhören | Vorfader-Abzweig auf getrennten Ausgang mit eigener Lautstärke |
| Set nachhören | Downloadbare Master-Aufnahme ohne Vorhörsignal |
| Schnell arbeiten | Tastenkürzel und weiterhin vorhandene Cue-/Queue-/Auto-Crossfade-Funktionen |

Die seltenere Licht-Detailbearbeitung liegt im Farbmodus-Menü des Decks.
Ausstattung und Ausgabe werden weiterhin im zentralen Bühnenfenster eingestellt.
Die vorhandene gemeinsame Lichtfarbe und automatische Mehrfarben-Show bleiben.

## Verifikation

- Modelltests für echte Stereo-Audiopeaks, dB-Skalierung, Cue-Grenzen,
  Loop-Grenzen und phasenerhaltende Beat-Sprünge.
- Browser mit erzeugten Audiodateien: tatsächliche Pegelsignale, EQ im
  Audiographen, stabiles manuelles Tempo, Loop-Rücksprung, Beat-Sprung, Sync,
  Master-Stummschaltung, persistente Hotcues und kodierte Aufnahme.
- Vorhörtest mit simulierten Geräte-IDs: gleicher Ausgang abgelehnt; Signal
  im Kopfhörerbus bei stummem Master; Gerätewechsel deaktiviert Vorhören.
  Keine physische Ausgangstrennung oder Latenz vermessen.
- Bestehender musikalischer Crossfade und DMX-Lichtshow bei Audiowiedergabe
  erfolgreich. Responsive Layoutprüfung bei 1440, 1024 und 390 Pixel Breite.

## Bewusste Grenzen

Loops verwenden HTMLMediaElement-Sprünge und einen Browser-Timer. Sie sind
nicht samplegenau; für enge Scratch-/Performance-Loops ist eine separate
Audio-Engine notwendig. Sync verlangt passende erkannte Beat-Raster.
Aufnahme wird im Speicher gehalten und bei zwei Stunden bzw. etwa 128 MB
beendet. Vor dem Schließen oder einer neuen Aufnahme herunterladen.
Der Kompressor ist kein garantierter True-Peak-Limiter.

Vorhören benötigt vom Browser unterstützte, freigegebene, getrennte physische
Ausgänge. Standard-/gleiche Geräte werden abgelehnt, Geräteänderungen schalten
Vorhören ab. Kein freies Routing einzelner Kanäle einer Mehrkanal-Soundkarte.
MIDI/HID-Controller, Scratch/Jogwheel, DVS, Stems, Effektketten und harmonische
Tonart-Analyse fehlen weiterhin. „Alle DJ-Funktionen“ ist damit kein Anspruch
auf vollständigen Ersatz einer professionellen DJ-Suite.

Grundlage der Audioausgangsanbindung:
[MDN: Audio Output Devices API](https://developer.mozilla.org/en-US/docs/Web/API/Audio_Output_Devices_API)
und [AudioContext.setSinkId](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/setSinkId).

Abschlussstand: 251 automatisierte Tests erfolgreich. Der abschließende
Performance-Browsertest inklusive Aufnahme und simuliertem Vorhör-Routing
sowie die Layoutprüfung sind erfolgreich. Web-Build und Diff-Prüfung ebenfalls.
[Desktopansicht](ux-layout-1440.png) · [Mittige Einstellungen](ux-settings-1440.png).

Korrektur: Die frühere automatische Tempoanpassung wurde entfernt.
„Musikalische Übergänge“ wählt ausschließlich geeignete Startstellen;
manuelles Tempo und Sync sind davon unabhängig.
