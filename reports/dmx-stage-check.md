# Virtuelle Lichtbühne

Dieser Bericht beschreibt die erste Version. Der neue individuelle
Gestaltungsmodus ist in `dmx-design-check.md` dokumentiert; der gemeinsame
Modus bleibt weiterhin verfügbar.

Die DJ-Seite bietet im Mixer „Virtuelle Lichtbühne öffnen“. Das nichtmodale
Fenster zeigt vier generische Dimmer/RGB-Scheinwerfer und eine RGB-Lichtleiste
mit acht Segmenten. Ohne Musik lässt sich ein ausdrücklich gekennzeichneter
Demo-Verlauf starten. Die laufende DJ-Show hat Vorrang. Die Vorschau hängt nicht
von einer WiZ-Sitzung ab und funktioniert damit auch bei „Nur Audio“.

Die Darstellung liest einen 512-Byte-DMX-Puffer, der aus dem vorhandenen
DJ-Lichtmix erzeugt wird. Dimmer/RGB und direkt gedimmte RGB-Segmente haben
unterschiedliche Kanalprofile. Die erste Version verteilt denselben Lichtmix
auf alle Geräte. Sie enthält keine Netzwerk-/USB-Ausgabe, Herstellerprofile,
Moving Heads oder physikalische Lichtberechnung.

## Prüfung

- `node --test test/dmx-model.test.mjs test/dj.test.mjs test/show-colors.test.mjs test/show-clock.test.mjs`: bestanden.
- `node scripts/check-dmx-stage.mjs`: bestanden, lokaler Demo-Server mit Headless Chrome.
- Browserprüfung: Demo, Vorschau-Blackout, globaler Stopp, bekannte Live-Farbe im Vorschau-Modul, mobile Fenstergrenzen, Escape und Fokusrückgabe; keine Browserfehler und keine gestartete Hardware-Musiksitzung.
- `node scripts/build-web.mjs`: erfolgreich; neue Module und Styles werden in die Web-Ausgabe übernommen.
- `node --check public/dmx-stage.js` und `git diff --check`: bestanden.

Die Prüfung des Live-Frames verwendet einen kontrollierten Eingabewert am
Vorschau-Modul. Ein kompletter Durchlauf mit realer Audiodatei und echter
DMX-Hardware ist damit nicht nachgewiesen.

Screenshots: `dmx-stage-desktop.png`, `dmx-stage-mobile.png`.
