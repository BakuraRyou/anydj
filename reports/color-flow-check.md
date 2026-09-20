# Rhythmische Farbpaarungen – Planversion 10

20.09.2026. Bisher pendelte ein Abschnitt überwiegend zwischen derselben festen
Farbpaarung. Nun wechseln die Paarungen auf musikalischen Ereignissen:
fließende Stellen auf akustisch ausgewählten Modell-Taktanfängen, intensive
Stellen nach jeweils zwei ausgewählten Akzenten. Ohne Taktanfänge werden im
fließenden Verlauf vier Akzente gruppiert; dies behauptet keine Taktart.
Ruhige Abschnitte haben keine solchen Wechsel. Eine intensive Stimmungspalette
behält einen kontrastierenden Anker der automatisch gewählten Palette.

153 Node-Tests bestanden. Regressionen prüfen ausgewählte Ereignisse, echte
Taktanfänge auch abseits eines Vierertakts, Ruhe ohne Anschläge, unterschiedliche
Paarungen und deterministische Wiedergabe nach Positionssprüngen.

Browservergleich der vorhandenen 264-Sekunden-MP3 mit tatsächlicher lokaler
Beat-This!- und Stilanalyse: Version 9 und 10 wurden mit identischen Eingaben
berechnet. Alle Helligkeitswerte und Beat-Timing-Daten waren exakt identisch.
Die mittlere Zahl unterschiedlicher Farbtonbereiche pro aktivem Acht-Sekunden-
Fenster stieg von 3,13 auf 5,17 (zwölf Messbereiche über den Farbkreis).
Fenster mit höchstens zwei Bereichen sanken von sechs auf eines. Der mittlere
RGB-Schritt stieg von 39,22 auf 46,05. 201 Farbpaarungs-Ereignisse. Diese Messwerte
belegen mehr Farbvariation, nicht automatisch eine bessere musikalische Wirkung.

Keine Browser-Ausnahmen; Demo-Modus, stumm, keine echten Lampen angesteuert.
Die in der Nutzernachricht erwähnte Links-/Rechts-Abbildung lag nicht vor;
daher kein spezifischer visueller Vergleich dieser beiden Stellen.
Messdaten: `color-flow-browser-check.json`.
