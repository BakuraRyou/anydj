# Gefühle in der Bibliothek

Die Bibliothek unterstützt mehrere Gefühls-Tags pro Lied. Das Filter-Popover enthält eine Mehrfachauswahl: Ein Titel erscheint, wenn mindestens eines der ausgewählten Gefühle passt. Suche, Statusfilter und Sortierung wirken zusätzlich. Die Warteschlange übernimmt weiterhin jeden sichtbaren Titel nur einmal.

## Analyse

`public/feeling-tags.js` fasst die vorhandenen Stimmungssegmente nach ihrer Dauer zusammen. Energie und belastbare tonale Hinweise liefern grobe Vorschläge. Vorhandene Desktop-Stildaten ergänzen spezifischere Hinweise für romantisch und episch. Die Regeln sind heuristische Vorschläge, keine gemessenen Wahrscheinlichkeiten; eine musikalische Qualitätsprüfung an einer repräsentativen Sammlung steht noch aus. Liedtexte werden nicht ausgewertet.

Es wird kein zusätzliches KI-Modell ausgeführt. Die Stilanalyse prüft ihren vorhandenen API-Endpunkt auch in der Web-Oberfläche. Ist der Dienst nicht erreichbar oder nicht installiert, entstehen Tags aus der Browseranalyse. Nur die Verfügbarkeitsabfragen für Beat und Stil haben eine Frist von 2,5 Sekunden; laufende Modellberechnungen erhalten dadurch kein Zeitlimit. Ohne erreichbare Modelle sind romantisch und episch weiterhin manuell zuweisbar.

Gespeicherte, gültige Show-Pläne erhalten ihre Vorschläge beim Laden ohne erneute Audioanalyse. Nach einer erneuten Liedanalyse werden die Vorschläge aktualisiert. Manuelle Ergänzungen und ausgeschlossene Vorschläge bleiben erhalten. Bei einer geänderten Datei im verbundenen Ordner werden alte automatische Ergebnisse bis zur neuen Analyse entfernt.

## Bedienung und Speicherung

- Tags stehen unter dem Tracktitel. Unter „Mehr → Gefühle bearbeiten“ lassen sich mehrere auswählen oder automatische Vorschläge wiederherstellen.
- „Gefühlskatalog erweitern“ im Filter-Popover fügt eigene Gefühle hinzu. Diese können manuell vergeben werden oder eine bestehende Erkennungsregel übernehmen. Ein eigener Name trainiert kein neues Modell.
- Katalog, automatische Ergebnisse und manuelle Korrekturen liegen in der vorhandenen IndexedDB. Die Filterauswahl bleibt im lokalen Browserspeicher erhalten. Die Daten werden nicht zwischen verschiedenen Browserprofilen synchronisiert.

## Prüfung

- `node --test test/feeling-tags.test.mjs test/dj-show-cache.test.mjs test/mood-analysis.test.mjs test/style-analysis.test.mjs test/beat-analysis.test.mjs test/analysis-no-deadline.test.mjs`
- `node scripts/check-library-view.mjs`: Filter/Sortierung, schmale und breite Ansicht, Katalogerweiterung, manuelle Mehrfachzuordnung, Speicherung nach Neuladen sowie echter WAV-Import mit ausgefallenen Analyse-Endpunkten in lokaler und Web-Oberfläche.
