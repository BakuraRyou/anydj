# Desktop-Pakete bauen

Auf dem **Build-Rechner** Node.js 22 oder neuer installieren, dann:

```sh
npm ci
# Analyseumgebungen + PyInstaller einmalig vorbereiten (siehe unten)
npm run pack:analysis
npm run pack
```

`pack` baut das aktuelle Betriebssystem. Explizite Ziele:

```sh
npm run pack -- --linux   # AppImage + Debian/Ubuntu-Installer (.deb), x64
npm run pack -- --win     # Windows-Setup (.exe), x64
npm run pack -- --all --lite # Basisversion für beide Ziele; ggf. Wine nötig
npm run pack -- --dir     # App-Verzeichnis ohne Installer, zum Testen
npm run desktop -- --demo # Entwicklung mit virtueller Lampe
```

Ausgabe: `dist/`. Windows auf Windows bauen, Linux auf Linux und macOS auf einem Mac.
Der manuell startbare GitHub-Workflow `Desktop installers` baut beide separat,
lädt die Dateien als Build-Artefakte hoch und veröffentlicht keinen Release.
Der Workflow wurde hier nicht ausgeführt. Builds sind noch nicht signiert.

## Vollständiges KI-Paket

Der Standard-Build enthält jetzt zusätzlich drei eigenständige Analyseprogramme
mit Python, Bibliotheken und lokalen Modellgewichten. Auf dem Zielrechner ist
keine Python-Installation erforderlich. Vor dem Installer-Build auf dem
**Build-Rechner** ausführen:

```sh
# Einmalig in den bereits eingerichteten Analyseumgebungen:
.venv-beat-this/bin/python -m pip install pyinstaller==6.22.0
.venv-style/bin/python -m pip install pyinstaller==6.22.0
.venv-structure/bin/python -m pip install pyinstaller==6.22.0
npm run pack:analysis
npm run pack -- --linux
```

Die Analyseumgebungen und Modelle werden zuvor über die vorhandenen
`scripts/install-*.sh` eingerichtet. Unter Windows sind entsprechende native
Python-Umgebungen unter `.venv-*/Scripts/python.exe` erforderlich; insbesondere
müssen alle nativen Analysebibliotheken für Windows verfügbar sein. Der
vollständige Windows-KI-Build ist noch nicht validiert. Ein Linux-KI-Paket kann
nicht in einen Windows- oder Mac-Installer übernommen werden.

`pack:analysis` erstellt `.build/analysis/<Betriebssystem>-<Architektur>/`.
Nach Änderungen an Python-Adaptern, Analysebibliotheken oder Modellen diesen
Schritt vor dem nächsten Installer-Build erneut ausführen.
`pack` prüft dessen Zielplattform und bricht ohne KI-Paket ab. Nur ausdrücklich
mit `--lite` entsteht die frühere Basisversion. Der manuelle GitHub-Workflow
baut weiterhin ausdrücklich diese Basisversion, bis native KI-Umgebungen auf
den Runnern eingerichtet sind.

Die ausführbaren Analyseprogramme entstehen mit PyInstaller als Verzeichnisse
mit eingebauter Laufzeit; normale Entwicklungs-venvs werden nicht kopiert.
Modelle bleiben im Installationsverzeichnis, beschreibbare JIT-/Grafik-Caches
liegen im Benutzerprofil. Fehlende Laufzeiten/Modelle in einem Vollpaket
verursachen eine Startfehlermeldung statt einer stillen Basisversion.

Linux-Binärdateien bleiben an die glibc-Basis des Build-Rechners gebunden.
Für breitere Distribution auf der ältesten unterstützten Linux-Version bauen;
ein Test auf diesem Rechner belegt keine Kompatibilität mit älteren Systemen.
Das Debian-Paket übernimmt die glibc-Version des KI-Builds als konservative
Mindestanforderung. Der aktuelle lokale Build verwendet glibc 2.43.

Bereits gespeicherte Teilanalysen bleiben im Bibliothekscache: Nach dem Update
betroffene Titel einmal über **Lichtshow neu berechnen** aktualisieren.
Private Lampendaten, Musikdateien und Berichte werden nicht eingepackt.

Die Hardwareausgabe erfolgt über DMX/OLA. Die App erstellt keine
NetworkManager-Profile und enthält keine WLAN-Lampensteuerung.
Linux-Pakete setzen ein unterstütztes Desktop-Linux mit den üblichen
Systembibliotheken voraus; AppImage benötigt je nach Distribution FUSE oder
kann mit `--appimage-extract-and-run` gestartet werden.

## Laufzeit und Daten

Die Desktop-App verwendet eine eigene, 34 Pixel hohe Fensterleiste im AnyDj-Stil.
Logo, Stopp, Einstellungen und Fensterbuttons teilen sich eine einzige Zeile.
Unter Windows und Linux enthält sie eigene Fensterbuttons; unter macOS sind die
nativen Fensterknöpfe integriert. Die Leiste bleibt in der großen Lichtshow und
bei modalen Dialogen bedienbar. Die Implementierung liegt in `titlebar.cjs` und
`window-chrome.mjs`; die Browseroberfläche benötigt keine Desktop-APIs.
Nach Änderungen an dieser Einbindung die Desktop-App neu starten. Installierte
Pakete übernehmen die Änderung erst mit einem neuen Desktop-Build.

Die App startet ihren Server ausschließlich auf `127.0.0.1:36931` und beendet
ihn zusammen mit dem Fenster. Der feste Ursprung erhält IndexedDB und
Browser-Einstellungen über Neustarts hinweg. Ein belegter Port führt zu einer
klaren Fehlermeldung, nicht zu einem Wechsel mit scheinbar leerer Bibliothek.
Nur eine Instanz wird gestartet. Ein zufälliger Sitzungsschlüssel wird im
Hauptprozess an die lokalen Requests angehängt. Node-Zugriff im Fenster ist
abgeschaltet; Sandbox und Kontextisolation sind aktiv.

Einstellungen, Bibliothek und Lampendaten liegen im Electron-Benutzerprofil
(`app.getPath('userData')`), außerhalb des Installationsordners. Der bisherige
Browser hat ein separates Profil: bestehende Bibliotheken werden nicht
automatisch in die Desktop-App übernommen.

## Validierung

```sh
npm test
npm run pack -- --linux
node scripts/check-analysis-bundle.mjs dist/linux-unpacked/resources/analysis
xvfb-run -a node scripts/check-desktop.mjs dist/linux-unpacked/anydj
```

Der Desktop-Smoke-Test benötigt Xvfb ausschließlich auf einem Linux-Testrechner
und verwendet ein temporäres Profil sowie eine Demo-Lampe. Ein Linux-Test
ersetzt keinen Windows-Laufzeittest und keinen Installationstest auf einem
sauberen Zielsystem.

## Vollständiges Release für die Downloadseite

`npm run release:desktop` bündelt die KI-Analyse und die App nativ für das aktuelle
System. Die fertigen Installer samt Größen und SHA-256-Prüfsummen werden unter
`.build/desktop-downloads/linux-x64/` bzw. `win32-x64/` bereitgestellt.
`-- --reuse-analysis` verwendet das vorhandene KI-Paket; die App wird neu gebaut.
Es gibt bei diesem Release-Befehl keinen Lite-Fallback und keinen Cross-Build.

`npm run deploy:full` verbindet diesen Build mit Website und FTPS-Veröffentlichung.
Details und der Ablauf für beide Plattformen: [gemeinsames Deployment](../builder/README.md#website-und-vollständige-desktop-apps-gemeinsam-veröffentlichen).

## Automatisierte Build-Umgebung

Die Einrichtung und die noch offenen Schritte zur Funktionsgleichheit stehen in
[Lokale Windows-Buildumgebung](windows-vm.md). `npm run init:apps` richtet den Windows-Gast und native Build-Abhängigkeiten ein.
Danach führt `npm run deploy:apps` Builds und Uploads aus. Ein optionaler Mac
wird über SSH angebunden. Windows und macOS benötigen weiterhin Laufzeittests.

Für den automatisierten Linux-/Windows-Ablauf mit einer vorhandenen Build-VM:
`npm run deploy:apps`. Einrichtung, Fehlerverhalten und Optionen stehen in
[Windows-VM: gemeinsamer Build und Upload](windows-vm.md#ein-befehl-für-linux-windows-vm-und-upload).

### App-Icon

Das Desktop-Icon verwendet das Logo aus `public/animatus-small.svg` auf einer dunklen Fläche. `desktop/icons/` enthält die eingebundenen PNG-, ICO- und ICNS-Dateien sowie die Linux-Größen. Das Entwicklungsfenster und die Pakete verwenden dieselben Assets.

Nach Änderungen am Logo: `python3 scripts/build-app-icons.py` ausführen (Pillow und Chrome/Chromium erforderlich). Die generierten Dateien werden eingecheckt; zum Starten und Paketieren ist keine erneute Konvertierung nötig. Für installierte Anwendungen wird das Icon mit einem neuen Desktop-Build aktualisiert.

### Lokale Audiodateien wiederherstellen

Die Desktopapp erneuert Lesefreigaben für bereits ausgewählte Datei-/Ordner-Handles im eigenen App-Fenster. Einzeldateien und Drag-and-drop-Importe werden zusätzlich über ihre nativen Dateipfade in `userData/data/audio-references.json` referenziert. Musikdateien werden dabei nicht kopiert. Nach Neuladen oder Neustart werden die pausierten Decks einschließlich ihrer Position wiederhergestellt. Fehlende oder veränderte Dateien müssen weiterhin zugeordnet bzw. neu analysiert werden.

Prüfungen: `node --test test/desktop-local-audio.test.mjs test/dj-session-restore.test.mjs`; vollständiger Electron-Neustarttest unter Linux: `node scripts/check-desktop-file-restore.mjs` (benötigt Xvfb).
