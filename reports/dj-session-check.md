# Browser-Arbeitsstand

Geprüft mit `node scripts/check-dj-session.mjs` in lokalem Headless Chrome mit echter Audiodatei:

- Deck-Belegung, Position und Cue nach Reload wiederhergestellt.
- Lautstärke, manuelles Tempo, EQ, Crossfader, Master, Übergangsdauer und musikalische Übergänge erhalten.
- Alle Decks nach Reload pausiert.
- Datei ohne dauerhafte Browserberechtigung direkt im Deck erneut verbunden; Position und Tempo erhalten, anschließend echte Wiedergabe erfolgreich.
- Bewusstes Entladen bleibt nach Reload erhalten.
- Keine JavaScript-Ausnahmen.

`npm test`: 252 Tests erfolgreich (Server-Tests mit lokalen Netzwerkports außerhalb der Sandbox).
Die automatische Wiederöffnung per dauerhaft freigegebenem File-System-Handle wurde nicht mit einem echten Ordnerdialog geprüft.
