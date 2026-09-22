# Gemeinsamer Website- und Desktop-Deploy

22. September 2026.

- `npm run deploy:full`: vollständiges natives Analysepaket, Installer, verifizierte
  Downloads, Hosting-Build und bestehender FTPS-Deploy mit Healthcheck/Rollback.
- `npm run release:desktop`: native vollständige Installer ohne Veröffentlichung.
- `--reuse-analysis`: vorhandene KI-Laufzeiten verwenden; App neu bauen.
- `--skip-desktop-build`: vorhandene Plattform-Releases prüfen und veröffentlichen.
- `--dry-run`: Website und Pakete lokal vorbereiten; keine FTP-Verbindung.
- Eigenständige `downloads.html`, verlinkt von Startseite und Web-DJ-Pult. Nur
  tatsächlich vorhandene Pakete haben Downloadlinks. Größen, SHA-256 und
  glibc-Anforderung werden aus dem geprüften Manifest erzeugt.

Der Linux-Release wurde mit den vorhandenen KI-Laufzeiten neu gebaut:
AppImage 824104193 Bytes, Debian-Paket 859423240 Bytes. Beide liegen unter
`.build/desktop-downloads/linux-x64/`. Sie enthalten lokale KI-Laufzeiten und
Modelle; der Installerbau ersetzt keinen Test auf fremden Linux-Distributionen.
Die Build-Basis benötigt glibc 2.43 oder neuer. Windows wurde auf diesem
Linux-Rechner nicht gebaut: Dafür ist der dokumentierte native Windows-Build
mit eigener Analyseumgebung erforderlich. Es wurde keine Lite-Version eingesetzt.

Upload und Rollback verarbeiten Installer über Streams bzw. temporäre Dateien.
Die Hosting-Bundle-Prüfung vergleicht SHA-256 statt vollständiger Dateien im RAM.
Die Node-Auslieferung streamt Dateien und unterstützt HEAD und Byte-Ranges.
Die bestehende Release-Sicherung enthält die Installer ebenfalls; Speicherbedarf
und Übertragungszeit sind in builder/README.md beschrieben.

Geprüft:

- `npm run release:desktop -- --reuse-analysis`: vollständiger Linux-Build erfolgreich.
- `npm run deploy:full -- --skip-desktop-build --dry-run`: Hostingpaket mit Downloads erfolgreich erstellt.
- Python `plan_bundle`: tatsächliches Hostingpaket einschließlich binärer Installer geprüft (162 Dateien).
- `npm test`: 331 Tests erfolgreich.
- `python3 -m unittest discover -s test -p 'deploy_test.py'`: 17 Tests erfolgreich.
- `node scripts/check-downloads.mjs`: zwei echte Downloadziele, Navigation,
  Unterordner-Hosting, HEAD und Range, 1280/390 Pixel, kein horizontaler Überlauf,
  keine Browserfehler. Screenshots: `/tmp/anydj-downloads-1280.png` und
  `/tmp/anydj-downloads-390.png`.

Keine Live-Veröffentlichung ausgeführt. Der bestehende GitHub-Workflow für
Lite-Installer bleibt unverändert; die neuen Release-Befehle bauen ausschließlich
vollständige native Pakete.
