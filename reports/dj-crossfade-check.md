# Auto-Crossfade und DJ-Layout

20.09.2026. Auto-Crossfade am Songende, optionaler Sofortstart und 2–20 Sekunden
Übergangszeit. Das vorbereitete Zieldeck startet am Cue-Punkt. Am Ende pausiert
das Ausgangsdeck, die gemeinsame Lichtsitzung bleibt erhalten. Bereits ausgeblendete
Tracks werden nicht als nächste automatische Ziele wiederverwendet. Die Liste
lädt weiterhin keine Folgetitel selbst nach. Manuelle Übernahme deaktiviert den
laufenden Übergang und die Automatik; die aktuelle Mischung bleibt erhalten.

Die Oberfläche verwendet 28 px Innenabstand und Abstand zwischen den Decks,
22 px Innenabstand auf kleinen Bildschirmen. Transport, Lautstärke, Crossfader,
Automatik und Bibliothek sind getrennte Gruppen. Deck A/B besitzen eigene
Akzentfarben. Auf kleinen Displays stehen die Decks untereinander.

Prüfung:
- 121 Node-Tests erfolgreich, inklusive beider Fade-Richtungen, Zeitgrenzen und
  Startbedingungen mit fehlendem, bereits spielendem oder verbrauchtem Zieldeck.
- Stummer Chrome mit Demo-Lampen und zwei 12-Sekunden-Dateien; lokale
  Standardanalyse statt KI, um ausschließlich die Wiedergabesteuerung zu prüfen.
- Automatischer Übergang A → B abgeschlossen: Fader 1, B läuft, A pausiert.
  Genau ein Sitzungsstart und kein Stopp während des Übergangs.
- Sofortiger Rückübergang gestartet und per manuellem Fader bei 0,4 abgebrochen.
  Fader blieb stehen, Automatik war aus.
- Desktop 1280 px: Deck-Padding und Grid-Abstand je 28 px.
- Mobil 390 px: eine Deck-Spalte, Padding 22 px, kein horizontaler Überlauf.
- Keine Browser-Ausnahmen. Messwerte: `dj-crossfade-browser-check.json`.
