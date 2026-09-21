# Individuelle DMX-Lichtshow

Der bisherige gemeinsame Lichtmix bleibt unverändert als erster Modus erhalten.
Der neue Gestaltungsmodus berechnet Farben und Animationen pro Gerät und mischt
bei zwei Decks deren abgestrahlte RGB-Werte pro Gerät/Segment. Beide Modi nutzen
denselben DMX-Encoder und die Simulation; es gibt keine Hardware-Ausgabe.

## Bedienung und Umfang

- Gesamte Bühne, drei frei zuordenbare Gruppen oder einzelne Geräte bearbeiten.
- Originalfarbe, Gegenfarbe, feste Farbe, bekannte DJ-Paletten und eigene Farben.
- Gespeicherte eigene DJ-Paletten werden beim Laden der Seite übernommen.
- Automatische Rollen, originale Helligkeit, ruhiges Licht, Beat-Impulse,
  Wechselakzente, Wellen und Lauflicht mit Dauer/Versatz in Beats.
- Regeln für den aktuellen Songabschnitt, getrennt nach Track-ID/Abschnittsstart.
- Lokale Speicherung, Vererbung, Rücksetzen einzelner Regeln, Fehlerhinweise.
- Vorschau bleibt neben den scrollbaren Einstellungen sichtbar; mobil kompakte Bühne.

Abschnittsregeln überschreiben allgemeine Regeln, innerhalb derselben Ebene
überschreiben Geräte ihre Gruppe und Gruppen die gesamte Bühne. Der Editor
zeigt bei zwei Decks den stärker gewichteten Track; die Ausgabe berechnet beide.
Ohne Beat-Raster folgen rhythmische Animationen der Ausgangshelligkeit. Die Demo
verwendet simulierte 120 BPM. Die gleiche Wiedergabeposition liefert dasselbe
Lichtbild; Seek benötigt keinen Neustart der Animation.

## Verifikation

- `npm test`: 222 Tests bestanden, keine Fehler.
- `node scripts/check-dmx-design.mjs`: Browserprüfung bestanden. Individuelle
  Farben, Wechsel zurück zum gemeinsamen Modus, Abschnittsvorrang, gespeicherte
  Werte nach Neuladen, Demo, Blackout, Stopp, mobile Grenzen und Tastatur geprüft.
- `node scripts/check-dmx-playback.mjs`: echter WAV-Import und Audiowiedergabe im
  DJ-Pult, individuelle Farbe, Abschnittsänderung, gemeinsamer Modus und Stopp
  erfolgreich. Beat-/Stilanalyse nutzt deterministische Testantworten, die
  Browser-Showberechnung und Wiedergabe laufen tatsächlich.
- Modelltests prüfen zusätzlich Beat-Interpolation, fehlendes Raster,
  Geräte-/Gruppenvererbung, Segment-Lauflicht und Crossfade pro Gerät.
- Web-Build und Syntaxprüfung erfolgreich; `git diff --check` ohne Befund.

Grenzen: feste generische Geräte, keine Art-Net-/USB-Ausgabe oder Moving Heads.
Abschnittsregeln sind keine semantische Wiedererkennung nach Neuanalyse:
veränderte Abschnittsgrenzen benötigen gegebenenfalls neue Regeln. Maximal 256
Abschnittsregeln; Speicherprobleme werden angezeigt. Browserdatenlöschung
entfernt Einstellungen. Farben auf einem Bildschirm sind keine photometrische
Simulation echter Scheinwerfer.
