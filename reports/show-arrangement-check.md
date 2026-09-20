# Automatische Show statt Dauerblinken

20.09.2026. Ausgangspunkt: Beat-genaue Impulse wurden musikalisch weiterhin als
permanentes Blinken erlebt. Planversion 7 ändert deshalb die Gestaltungslogik,
nicht erneut die Beat-Erkennung.

Automatik:
- Getragenes Grundlicht statt Rückfall zur Mindesthelligkeit nach jedem Beat.
- Gehaltene Farben für ruhige Passagen; fließende Strophen; Helligkeitsaufbau
  über Aufbauten; intensivere Refrains mit begrenzten einzelnen Akzenten.
- Langsame Farbentwicklung innerhalb einer Passage, wiederkehrende Farbgruppen.
- Akzente höchstens alle 3,5 Sekunden, ausschließlich auf ausgewählten
  Modell-Taktanfängen beziehungsweise vorhandenen Beats. Sie heben die
  Helligkeit kurz um einen kleinen Teil des verfügbaren Bereichs an.
- Ohne KI-Songstruktur erfolgt die Auswahl über die bisherigen Energie- und
  Klangabschnitte. All-In-One verfeinert nun auch die Helligkeitsbögen.
- Digitale Stille bleibt auf Minimum. Manuelle Gestaltung behält ihre bisherigen
  Beat-Pulse. Live-Automatik wählt fließendes Licht statt Disco als Standard.

Prüfung:
- 131 Node-Tests erfolgreich. Neue Szenarien prüfen Intro/Strophe/Refrain/Outro,
  Unterschiede der Helligkeit, Ruhe zwischen Akzenten, Konstanz bei konstantem
  Klang, Stille trotz behaupteter Modell-Beats, Seek und Wiederholbarkeit.
- Echter Browser mit der vorhandenen Robbie-Williams-Datei und Beat This!:
  544 erkannte Beats, 40 ausgewählte Akzente in der Basis-Show, 24 mit den
  16 bereits vorliegenden All-In-One-Abschnitten.
- Als Vergleich wurde der manuelle Pulsrenderer mit denselben effektiven
  Einstellungen ausgeführt: 888 aufeinanderfolgende Bildsprünge über
  20 Helligkeitspunkte; beide neuen automatischen Pläne hatten keinen solchen
  Sprung. Dies misst die Gestaltung, nicht die optische Lampenantwort.
- Anteil der vorbereiteten Bilder nahe Minimum: rund 35 % beim Pulsvergleich,
  rund 0,7 % bei der neuen Automatik. Helligkeitsgrenzen bleiben erhalten.
- Struktur für den Vergleich aus der früheren lokalen Inferenz wiederverwendet;
  keine neue Strukturinferenz, keine realen Lampen. Keine Browser-Ausnahmen.

Messwerte: `arranged-show-browser-check.json`. Eine automatisch komponierte
Choreografie ist weiterhin eine Heuristik; die subjektive musikalische Qualität
muss im Zusammenspiel mit der realen Lampe beurteilt werden.
