# Redesign: Startseite und Downloads

## Umfang

Die öffentlichen Seiten in `web/` wurden vollständig neu gestaltet: dunkle
Flächen, mintfarbene Akzente, klare Typografie, gemeinsamer Header und Footer.
Der DJ-Modus wurde für dieses Redesign nicht verändert.

Die Startseite erklärt Mix, dynamische Übergänge und Licht, zeigt eine echte
Aufnahme der Browser-Demo und unterscheidet Web-Demo und Desktop-Funktionen.
Die Downloadseite bündelt Plattformwahl, Paketinformationen, Installation und
Systemvoraussetzungen. Downloadlinks werden weiterhin nur aus geprüften
Release-Manifesten erzeugt; fehlende Plattformpakete bleiben ohne Downloadlink.

`web/product-preview.webp` stammt aus dem aktuellen DJ-Pult mit synthetischen
Demo-Tracks. `scripts/build-web.mjs` kopiert das Bild; Vorschau- und Hostingserver
liefern WebP mit passendem Content-Type. Keine externen Schriften oder Bilddienste.

## Validierung

- `npm run build:web` und `npm run build:hosting`: erfolgreich.
- `node scripts/check-site.mjs`: beide Seiten bei 1440, 768, 390 und 320 Pixeln,
  ohne horizontalen Überlauf; Bild, Navigation, FAQ und Downloadverfügbarkeit geprüft.
- `node scripts/check-downloads.mjs`: zwei vorhandene Linux-Installer erreichbar,
  Unterordner-Hosting, Desktop/Mobilansicht, HEAD und Range-Downloads erfolgreich;
  keine Browserfehler.
- `node --test test/desktop-downloads.test.mjs test/hosting.test.mjs`: 8 Tests bestanden,
  einschließlich WebP-Auslieferung und Release-Integrität.
- `git diff --check`: erfolgreich.

Screenshots: `/tmp/anydj-site-{index,downloads}-{1440,768,390,320}.png`.
Lokal erstellt und geprüft; nicht auf einen öffentlichen Server deployt.
