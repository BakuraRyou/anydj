# Songabhängige Bewegungsplanung

Die ausgewogene Automatik verwendet vorhandene Phrasenmerkmale und optionale
Instrumentenanalyse, keine Dateinamen, Zufallsfiguren oder festgelegten Songpaare.
`public/dmx-moving-direction.js` trennt Formationswahl, Weite, Tempo, Mindestabstand
und Fahrzeit. Wiederholte Motive werden nur bei ähnlicher Energie, Klangfarbe und
Instrumentenbalance wieder aufgegriffen. Die Figurenfolge beginnt pro Phrase neu.

`dmx-moving-cues.js` legt die Ziele auf tatsächlich ausgewählte Musikereignisse.
Zu große Sprünge werden verkürzt; die Smoothstep-Fahrt endet auf dem Zielzeitpunkt.
Bisherige Grenzen von 70 Grad/s Pan und 0,8 normierten Tilt-Einheiten/s bleiben
bestehen; atmosphärische Figuren haben engere Geschwindigkeitsgrenzen.
Fehlende Ereignisse führen zum Halten, nicht zu künstlichen Beats.

Die bestehenden vorbereiteten Zeitspuren bleiben seekbar und werden beim
Deckwechsel weiterhin helligkeitsgewichtet gemischt. Die neue Gestaltung gilt
für Automatisch/Ausgewogen. Explizite Modi und Stimmungen bleiben erhalten.
Die Grenzwerte gehören zur Vorschau, sie sind keine Zusage für reale Motoren.

Gezielte Tests prüfen Motivrückkehr, musikalisch unterschiedliche Figuren,
progressive Fächeröffnung, Zielankunft, Haltephasen, Geschwindigkeiten über
Abschnittswechsel, Seeking und die unveränderten expliziten Modi. Zusätzlich
werden die bestehende Testsuite, der Web-Build und die Browserprüfung der
Moving-Head-Vorschau ausgeführt. Musikalische Wirkung bleibt gestalterisch und
muss mit verschiedenen realen Songs beurteilt werden.
