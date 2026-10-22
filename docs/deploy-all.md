# Desktop-Builds auf Linux, macOS und Windows

```sh
pnpm run deploy:all
```

Auf dem Linux-Entwicklungsrechner gestartet, synchronisiert dieser Befehl den aktuellen lokalen Projektstand einschließlich uncommitteter und neuer Dateien. Linux baut lokal, macOS und Windows nativ per SSH. Alle drei verwenden denselben Snapshot und dieselbe Version aus `package.json`. Die vollständigen Installer enthalten die lokalen KI-Laufzeiten und Modelle. Nach erfolgreichen Builds werden die Website und die Downloadseite einschließlich aller geprüften Installer über das vorhandene FTPS-Deployment veröffentlicht.

Die geprüften Ergebnisse liegen anschließend unter:

| Ziel | Ordner | Installer |
| --- | --- | --- |
| Linux x64 | `.build/desktop-downloads/linux-x64/` | AppImage und DEB |
| Windows x64 | `.build/desktop-downloads/win32-x64/` | EXE |
| macOS, native Architektur | `.build/desktop-downloads/darwin-arm64/` oder `darwin-x64/` | DMG |

Jeder Ordner enthält ein Manifest mit Version, Dateigrößen und SHA-256-Prüfsummen. Zurückgeholte Installer werden geprüft, bevor sie einen bisherigen Download-Ordner ersetzen. Schlägt ein Ziel fehl, werden die übrigen trotzdem versucht; der Gesamtbefehl endet mit einem Fehlerstatus. Bei einem Build- oder Prüffehler findet keine Veröffentlichung statt. Ein Uploadfehler lässt die lokalen Installer erhalten; mit `--publish-only` kann die Veröffentlichung ohne neue Builds erneut gestartet werden. Auch die Versionen aller lokalen Downloadpakete müssen zur aktuellen `package.json` passen.

## Einrichtung

1. Auf allen Rechnern Node.js >= 22, pnpm, Python und `tar` bereitstellen. Die KI-Pythonpakete müssen für die native Architektur verfügbar sein; die bestehenden Anforderungen stehen in `scripts/*requirements*`. Auf macOS die Xcode Command Line Tools installieren. Windows benötigt OpenSSH Server und für native Python-Abhängigkeiten gegebenenfalls die Microsoft C++ Build Tools. Systempakete installiert der Befehl nicht.
2. Vom Linux-Rechner einmal interaktiv per SSH anmelden, Host-Schlüssel prüfen und die Schlüsselanmeldung einrichten. `ssh-add` lädt einen passwortgeschützten Schlüssel in den Agenten. Der Build verlangt bekannte Host-Schlüssel und eine Anmeldung ohne interaktive Passwortabfrage.
3. `deploy-all.example.json` nach `deploy-all.json` kopieren und die absoluten Pfade anpassen. Das Beispiel verwendet für den Intel-Mac und Windows die unten beschriebenen eigenen Python-Laufzeiten. Die lokale Verbindungsdatei wird durch `.gitignore` ausgeschlossen.

Vorhandene Animatus-Verbindungen lassen sich direkt übernehmen:

```sh
pnpm run deploy:all --init-from /home/erikh/Desktop/Projekte/Animatus/Modules/Animatus-Desktop/deploy-all.json
```

Dabei werden SSH-Ziele und Werkzeugpfade übernommen, eigene benachbarte `AnyDj Build`-Ordner verwendet und keine Animatus-Zugangsdaten kopiert. Eine vorhandene Konfiguration wird nicht überschrieben. Die Animatus-Werkzeugpfade müssen weiterhin existieren. Optional unterstützen die Ziele `port`, `identityFile`, `knownHostsFile`, `pnpm`, `python` und `environmentRoot`. `node` ist auf beiden SSH-Zielen erforderlich; `python` wird sonst als `python3` beziehungsweise `python.exe` über PATH gesucht. Auch Pfade mit Leerzeichen sind unterstützt. Der Mac baut die Architektur seines konfigurierten Node-Interpreters. Standardmäßig wird die aus Animatus übernommene unsigned-Einstellung verwendet; `unsigned: true` deaktiviert die automatische Suche nach einer Signieridentität.

```sh
pnpm run deploy:all:check       # SSH, OS, Architektur, Node, Python, pnpm und tar
pnpm run deploy:all --dry-run   # Quell-Snapshot prüfen, ohne Netzwerk und Build
pnpm run sync:all               # Nur Quellen übertragen und Prüfsummen prüfen
pnpm run deploy:all             # Alle drei Builds und Website/Downloads veröffentlichen
pnpm run deploy:all --build-only # Nur bauen, ohne Upload
pnpm run deploy:downloads        # Vorhandene Installer veröffentlichen, ohne SSH/Builds
pnpm run deploy:all --publish-only --dry-run # Downloadseite/Hosting lokal vorbereiten
pnpm run deploy:all --reuse-analysis  # Vorhandene KI-Bundles bewusst weiterverwenden
pnpm run deploy:all --config /absoluter/pfad/deploy-all.json
pnpm run deploy:all --target mac # Einzelnes Ziel bauen, danach vorhandene Pakete veröffentlichen
pnpm run deploy:all --ftp-config /absoluter/pfad/ftp.json # Eigene FTPS-Konfiguration
```

## Veröffentlichung auf der Downloadseite

Standardmäßig verwendet der Upload `builder/ftp/.env`; `--ftp-config` wählt eine andere FTPS-Konfiguration. `--config` bleibt ausschließlich die SSH-Buildkonfiguration. Beide tatsächlich verwendeten Konfigurationsdateien werden vom Quell-Sync ausgeschlossen. FTP-Zugangsdaten werden nicht an die Build-Rechner übertragen.

Der Abschluss ruft den bestehenden `deploy:full`-Ablauf mit `--skip-desktop-build` auf: Hosting-Paket und Downloadkarten werden erstellt, Installer und Website per FTPS übertragen und das Release über den vorhandenen Healthcheck geprüft. Dateigrößen und SHA-256 werden vor der Veröffentlichung erneut geprüft. Die vorhandene Aktivierung und Rückfall-Releases bleiben Teil dieses Ablaufs.

Eine gemeinsame Sperre `.build/deploy-hosting.lock` verhindert gleichzeitig laufende Hosting-Deployments, die dasselbe Ausgabeverzeichnis verwenden. Nach einem harten Prozessabbruch diese Sperre erst entfernen, wenn kein Deployment mehr läuft.

`--publish-only` verwendet die lokalen Installer und kontaktiert die SSH-Build-Rechner nicht. Ohne `--target` müssen Pakete für alle drei Betriebssysteme vorhanden sein. `--publish-only --dry-run` erstellt nur das lokale Hosting-Paket. Das gewöhnliche `--dry-run` prüft weiterhin ausschließlich den lokalen Quell-Snapshot. `--build-only`, `--sync-only`, `--check` und die Einrichtung führen keinen Upload aus.

## Synchronisation und Caches

Die Synchronisation umfasst den Projektquellstand, Tests, Dokumentation und Lockfiles. Ausgeschlossen sind Git-Metadaten, `node_modules`, generierte Ausgaben, lokale Einstellungen/Zugänge (`.env`, `.aws`, `.codex`, `.agents`, Zertifikate, bekannte SSH-/Cloud-Schlüssel und lokale Build-Verbindungen), private Musik-/Videodateien, `data/` und Python-Umgebungen. Mitgelieferte Medien unter `public/`, `web/` und `desktop/` gehören zum Quellstand und werden übertragen. Symlinks und nicht unter Windows nutzbare Dateinamen führen zu einem Fehler. `--dry-run` zeigt Anzahl und Gesamtgröße der Dateien.

Auf jedem Rechner entsteht `<root>/runs/<Auftrags-ID>/source/`. Dadurch sind auch lokal gelöschte Quelldateien im nächsten Build verschwunden. Ein SHA-256-Manifest prüft die Dateien vor der Installation. Abhängigkeiten werden pro Betriebssystem mit `pnpm install --frozen-lockfile` installiert.

Modelle, native Python-Umgebungen und KI-Bundles bleiben unter `<root>/cache/`; `environmentRoot` kann stattdessen auf eine bestehende AnyDj-Buildumgebung zeigen. Linux verwendet standardmäßig die bereits vorhandenen Umgebungen im Projekt. Die erste Ausführung richtet fehlende KI-Umgebungen mit `prepare-build-host.mjs` ein und lädt Modelle. Das kann viel Zeit und mehrere Gigabyte Speicher benötigen. Änderungen an den Setup-Skripten oder Requirements aktualisieren die Umgebungen. Ohne `--reuse-analysis` werden die KI-Bundles jedes Mal neu gebaut.

Die einzelnen Arbeitsordner bleiben für Diagnose und die dortigen Installer erhalten. Alte `<root>/runs/<Auftrags-ID>` können nach einem abgeschlossenen Build gelöscht werden; die Cache-Ordner behalten. Während eines Builds keine Caches oder Arbeitsordner löschen und keine weiteren Builds mit demselben Cache starten. Lokale Sperren pro Ziel verhindern konkurrierende Builds desselben Ziels; unterschiedliche Einzelziele können parallel laufen. Nach einem harten Prozessabbruch eine verwaiste `.build/deploy-all-<Ziel>.lock` erst entfernen, wenn dort kein Build mehr läuft.

## Verbindungsfehler

`No route to host`: Ziel einschalten, ins gleiche erreichbare Netzwerk bringen und Hostnamen/IP prüfen. `Permission denied`: SSH-Schlüssel, Benutzer und Agent prüfen. Beide Ziele müssen bei `deploy:all:check` erfolgreich sein, bevor vollständige Builds starten. Es werden keine Kennwörter gespeichert und keine bestehenden Animatus-Projektordner überschrieben.

Mac-Befehle laufen unter `caffeinate -i`, damit der Rechner während eines aktiven Builds nicht automatisch in den Ruhezustand wechselt. Ein geschlossener Laptopdeckel oder ein unterbrochenes Netzwerk kann die Verbindung weiterhin trennen.

## Native KI-Abhängigkeiten

Intel-Macs verwenden eigene Requirements (`*-mac-intel-requirements.txt`) und gemeinsame Versionsgrenzen in `mac-intel-constraints.txt`: PyTorch/Torchaudio 2.2.2, NumPy 1.26.4 sowie kompatible SciPy-/ONNX-/Librosa-Versionen. Die aktuelle Linux-/Windows-Auswahl bleibt getrennt. Die Paketgrenzen folgen den [PyPI-Metadaten von rotary-embedding-torch](https://pypi.org/pypi/rotary-embedding-torch/0.8.6/json) und den verfügbaren [ONNX-Runtime-Wheels für Intel-Macs](https://pypi.org/project/onnxruntime/1.19.2/#files).

Apples Python 3.9 ist für aktuelle Beat-This!-Typannotationen zu alt. Ein isoliertes Python 3.11 lässt sich ohne Administratorrechte einrichten:

```sh
node scripts/setup-mac-intel-python.mjs '/Users/YOUR_USER/AnyDj Build'
```

Das Skript lädt die prüfsummenverifizierte uv-Version 0.13.4 und installiert darüber ein verwaltetes Python 3.11 ausschließlich im Build-Werkzeugordner ([uv-Dokumentation](https://docs.astral.sh/uv/guides/install-python/)). `mac.python` auf `<root>/tools/python-intel` setzen und einen eigenen `environmentRoot` wie `<root>/cache-py311` verwenden. System-Python und Shell-PATH werden nicht geändert.

Windows braucht für die aktuellen Requirements Python >= 3.12. Die mitgelieferte Einrichtung installiert [Python 3.14.4](https://www.python.org/downloads/release/python-3144/) als Benutzerinstallation im eigenen Werkzeugordner und prüft vorher die Authenticode-Signatur der Python Software Foundation:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/setup-ssh-build-python.ps1 -BuildRoot 'C:\Users\YOUR_USER\AnyDj Build'
```

Danach `windows.python` auf `<BuildRoot>\tools\python-3.14.4\python.exe` setzen. Beim Wechsel von einer alten Python-Version zusätzlich einen neuen `environmentRoot`, etwa `<BuildRoot>\cache-py314`, verwenden, damit native Pakete unterschiedlicher Python-Versionen nicht vermischt werden. Die Einrichtung ändert weder PATH noch Dateizuordnungen und benötigt keine systemweite Python-Ersetzung.

Für portable Windows-KI-Pakete überträgt der Build zusätzlich die offiziellen app-lokalen Microsoft-CRT-DLLs aus `.build/vm/msvc/ready/`. Fehlen sie, bereitet das vorhandene `scripts/vm/prepare-msvc.py` sie auf Linux aus dem Microsoft-Redistributable vor; dafür ist `7z` erforderlich. `windows.runtimeSource` kann einen anderen absoluten Linux-Pfad zu diesem Runtime-Manifest angeben. Vor der Übertragung werden Dateigrößen und SHA-256 geprüft; Windows prüft die Microsoft-Signaturen. Beim Bündeln werden diese konsistenten DLLs neben jede eingefrorene Python-Laufzeit kopiert, damit ältere System-/Build-DLLs keinen `c10.dll`-Initialisierungsfehler verursachen. Es wird kein systemweites Microsoft-Runtime-Update vorausgesetzt.

Vollständige Releases führen vor dem Packen einen portablen Inferenztest mit synthetischem Audio aus (`scripts/check-analysis-smoke.mjs`). Er prüft Beat-, Stil-, Struktur- und Instrumentanalyse mit leerem Programm-PATH und ohne Entwickler-Python. Ein Importfehler oder inkompatibles Modell beendet den Build vor der Installer-Erstellung.

### Schlüsselbund statt wiederholtem ssh-add

Unter einem Linux-Desktop mit GCR-Schlüsselbund kann pro SSH-Ziel `"identityAgent": "/run/user/1000/gcr/ssh"` und `"identityFile": "/home/YOUR_USER/.ssh/id_ed25519"` hinterlegt werden. UID und Pfade anpassen. Damit verwenden SSH und SCP ausdrücklich den Desktop-Agenten, auch wenn ein Terminal einen anderen, leeren Agenten vererbt. Der Schlüssel muss im Desktop-Schlüsselbund entsperrt sein; dessen gespeicherte Passphrase kann beim Login automatisch entsperrt werden. Ist der Schlüsselbund gesperrt oder läuft kein Desktop-Agent, schlägt die nichtinteraktive Anmeldung weiterhin mit einem klaren Fehler fehl. Die private Schlüsseldatei und Passphrase werden niemals synchronisiert.
