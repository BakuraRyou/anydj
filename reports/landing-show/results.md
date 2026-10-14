# Startseiten-Lichtshow – Prüfergebnis

## Umsetzung

- Das bisherige Produktbild unter der Headsektion wurde durch eine bedienbare 3D-Bühne ersetzt.
- Drei synthetische Demo-Tracks mit vorberechneten JSON-Shows; je vier Moving Heads und vier Scheinwerfer.
- Play/Pause, Seek, Lautstärke, Kamera per Maus/Tastatur und Zoom.
- Show-Zeit folgt der Audiodatei. Datenformat mit Versionsnummer und Validierung; Integration eines späteren Admin-Backends über reguläre JSON-Dateien.
- Selektives Nachladen, maximal 30 Renderbilder/s, adaptive Renderauflösung, Pausieren außerhalb des sichtbaren Bereichs, bewegungsarme Ansicht, WebGL-/Canvas-Ausweichlösung.
- Passendes 3D-Poster, responsives Layout und Audio-Hosting mit Byte-Ranges.

## Verifikation

- `npm run build:hosting`: erfolgreich, einschließlich Web-Build und Validierung der drei Shows.
- `node --test test/landing-show.test.mjs test/hosting.test.mjs`: 9/9 erfolgreich.
- `node scripts/check-landing-show.mjs`: erfolgreich mit echtem lokalen Hosting und dessen Content Security Policy.
- Browserprüfung: drei Shows abspielbar, selektives Laden, Pause/Seek, Pause beim Wegscrollen, mobile Breite/Renderauflösung, kein dauerndes Rendering bei reduzierter Bewegung, schneller Auswahlwechsel, ungültige JSON-Datei und Wiederherstellung, Canvas-Fallback bei deaktiviertem WebGL, keine unbehandelten Laufzeitfehler.
- Syntaxprüfung und `git diff --check`: erfolgreich.

Screenshots: `desktop.png`, `mobile.png`. Maschinenlesbares Ergebnis: `browser.json`.

## Grenzen

Headless Chrome verwendet SwiftShader. Die letzte kurze Desktop-Messung ergab 39 Renderbilder in rund 2 Sekunden während automatischer Auflösungsanpassung. Das ist kein Hardware-GPU- oder Smartphone-Benchmark; 30 FPS auf echten Mobilgeräten sind damit noch nicht nachgewiesen.

Die Auslieferung wurde lokal gebaut, nicht veröffentlicht. Das zukünftige Admin-Backend existiert noch nicht; die JSON-Schnittstelle ist in `docs/landing-show.md` dokumentiert. Die mitgelieferten Tracks sind synthetische Beispiele und können durch Audio mit passend vorberechneter Show ersetzt werden.
