# Musikalische Aufmerksamkeit und zusätzliche Anschläge

23. September 2026 · Show-Version 21, Arrangement-Version 7.

Die automatische Show ergänzt messbare kurze Anschläge außerhalb der bisher
gewählten Rasterakzente. Grundlage sind die vorhandenen 20-ms-RMS-/Bassfenster.
Ein relativer Pegelanstieg und ein anschließender Abfall müssen gemeinsam
vorliegen. Spektraländerung allein, Stille und dauerhafte Pegelsprünge reichen
nicht aus. Bestehende Akzente haben Vorrang; Mindestabstände und zurückhaltende
Stärken begrenzen die Dichte. Gehaltene Passagen erhalten keine Zusatzimpulse.
Bei vorhandenen Instrumentendaten muss zudem Schlagzeugaktivität vorliegen.
Die Erkennung funktioniert auch ohne ein extern erkanntes Beat-Raster.

Pro visueller Phrase wird aus den vorhandenen Instrumentenpegeln eine gemeinsame
Gewichtung berechnet. Nur ein deutlich dominanter Anteil verändert die Regler.
Eine führende Stimme senkt Akzentstärken um höchstens 18 Prozent und die geplante
Bewegungsgeschwindigkeit um höchstens 35 Prozent. Bewegungsabstände und Reisezeiten
wachsen entsprechend. Zusätzliche kontrastreiche Farbakzente brauchen stärkere
Evidenz; die Farbidentität der Phrase und Klangwechsel bleiben erhalten.
Dominante Begleitung wird schwächer beruhigt. Bass und Schlagzeug behalten ihren
Antrieb. Fehlende, stille oder uneindeutige Instrumentendaten ergeben neutrale
Gewichte. Die Werte sind gestalterische Heuristiken, keine Modellkonfidenzen.

Alles wird bei der Show-Vorbereitung berechnet. Die Wiedergabe liest weiterhin
vorbereitete Ereignisse und Bewegungsspuren. Der Show-Cache wird durch die neue
Version erneuert. Die Instrumententrennung selbst wurde nicht geändert; ihre
100-ms-Pegel sind weiterhin keine präzise Transkription von Gesang oder Instrumenten.
Der Zusatzdetektor ist auf kurze Anschläge beschränkt, nicht auf alle musikalischen
Einsätze. Dichte Passagen dürfen zusätzliche Anschläge bewusst auslassen.

Validierung:

- `npm test`: 395 Tests erfolgreich, einschließlich neuer Regressionen für
  Synkopen mit/ohne Raster, Doppelakzente, Stille, Dauertöne, Pegelsprünge,
  neutrale Rückfälle, gemeinsame Gesangsgewichtung und reproduzierbare Seek-Ausgabe.
- `node scripts/check-section-lighting.mjs`: erfolgreich; Instrumentendaten,
  Editor, Motivübernahme, Speicherung, Teilung/Zusammenführung, Abbruch und
  mobile Ansicht geprüft, keine Browser-Ausnahmen. Die Selektoren adressieren
  jetzt gezielt den Abschnittseditor statt den ersten beliebigen Dialog.
- Die Server-Auslieferung enthält das neue Modul. Eine bereits im HTML
  referenzierte, zuvor nicht ausgelieferte `brand.css` wurde ebenfalls registriert.
- Der Abschnittslicht-Browsertest verwendet nun den tatsächlichen Standardwert
  `maximum:100` für seine Cache-Signatur statt des veralteten Werts 75.

Die physische Lichtwirkung und Geräteverzögerung wurden nicht gemessen.
Ein vergleichbares Hör-/Seh-A/B an echten Lampen bleibt für die ästhetische
Abnahme erforderlich. Lampenkalibrierung und eine neue Dramaturgie über den
vollständigen Song sind nicht Bestandteil dieser Iteration.
