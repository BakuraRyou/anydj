# Layout und Bedienbarkeit des bestehenden DJ-Pults

Umgesetzt am 20.09.2026. Das bestehende Konzept mit zwei Decks, Mixer,
Bibliothek und Warteschlange bleibt erhalten.

- Einheitliche Abstände, bündige Panels, größere Bedienflächen und lesbarere
  Statusmeldungen. Bibliotheksaktionen erhalten bei schmaleren Panels eine
  eigene Zeile. Mobil stehen die beiden Listen untereinander.
- Lichtbühne ohne horizontalen Überlauf bei vier Scheinwerfern. Lichtstrahlen
  bleiben innerhalb der jeweiligen Gerätespalte.
- Bühnenfenster mit Lichtmodus zuerst. Ausstattung, Verbindung,
  Vorschau-Demo und Kanalbelegung sind aufklappbare Bereiche. Verbindungsstatus
  bleibt auch bei geschlossenem Verbindungsbereich sichtbar.
- Ein Scrollbereich für das Einstellungsfenster statt verschachtelter
  Scrollflächen. Fachliche Details der Automatik sind einklappbar.
- Keine Änderungen an Showberechnung, Audio oder DMX-Protokoll.

Prüfungen:
- `node scripts/check-dj-layout.mjs`: 1440 × 900, 1024 × 800 und 390 × 844;
  bündige Panelhöhen am Desktop, kein horizontaler Seiten-/Bühnen-/Dialogüberlauf,
  keine innere Scrollfläche im Editor, Geräte hinzufügen, Escape und Fokus.
- `node scripts/check-dmx-mixed.mjs`: gemischte Ausstattung, Segmentänderungen,
  gespeicherte Gestaltung, Migration und Mobilansicht erfolgreich.
- `node scripts/check-dmx-connection.mjs`: simulierte DMX-Verbindung einschließlich
  Demo-Trennung und Abschalten bei geänderter Ausstattung erfolgreich.
- Screenshots visuell geprüft: Desktop-Hauptansicht und mobiles Einstellungsfenster.
- Web-Build und JavaScript-Syntaxprüfung erfolgreich.

Screenshots: [Desktop](ux-layout-1440.png), [Tablet](ux-layout-1024.png),
[Mobile Einstellungen](ux-settings-390.png).
