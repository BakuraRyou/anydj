# Deployment auf Netcup / Plesk

## Lokal vorbereiten

Voraussetzungen: Node.js 22 oder neuer und Python 3. Keine zusätzlichen npm- oder
Python-Pakete nötig. `builder/ftp/.env` enthält **JSON**, keine Shell-Variablen.
Vorlage: [ftp/.env.example](ftp/.env.example). Die Datei wird ignoriert und nie
hochgeladen. `localDir` ist trotz des Namens der **entfernte FTP-App-Pfad**:
Bei einem auf das App-Verzeichnis eingeschränkten FTP-Benutzer ist dieser Pfad
`/`. Nur wenn der Benutzer den übergeordneten Webspace sieht, ist er beispielsweise
`/anydj.de`. Der FTP-Pfad ist unabhängig vom vollständigen Application Root in
Plesk; die Plesk-Einstellungen bleiben auf dem dort angezeigten App-Verzeichnis.

`secure` ist standardmäßig `true`: explizites FTPS auf Port 21 mit überprüftem
Zertifikat. Falls bisher eine IP eingetragen wurde, kann der zum TLS-Zertifikat
passende FTP-Hostname des Hosters nötig sein. `secure: false` wählt ausdrücklich
unverschlüsseltes FTP. Es gibt keinen automatischen Rückfall auf Klartext und
keine Abschaltung der Zertifikatsprüfung. `shell*`-Felder können bleiben; für
Passenger-Deployments inklusive Neustart genügt FTP und es wird kein SSH benötigt.
`publicUrl` ist die HTTPS-Domain, hier `https://anydj.de`.

Wenn der Hoster eine konkrete IP als Verbindungsziel vorgibt, kann zusätzlich
`tlsServername` den DNS-Namen aus seinem Zertifikat enthalten. Die Verbindung
bleibt dann auf der konfigurierten IP; Zertifikatskette und DNS-Identität werden
weiterhin vollständig geprüft. Beim angegebenen Netcup-Endpunkt lautet der
Zertifikats- und Reverse-DNS-Name `a2e2e.netcup.net`.

```sh
npm run deploy -- --dry-run  # baut alles, zeigt das Ziel; kein Netzwerkzugriff
npm run deploy:check        # prüft FTP-Anmeldung und Ziel, schreibt nichts
npm run deploy             # Build, Upload, Aktivierung, Restart und Healthcheck
```

Alternative Konfiguration: `npm run deploy -- --config /pfad/zur/datei.json`.
Passwörter werden weder als Prozessargumente übergeben noch ausgegeben.

## Plesk einmalig einstellen

Für die erste Übertragung vor Aktivierung der Node.js-App:

```sh
npm run deploy -- --skip-health
```

Danach unter **Websites & Domains → anydj.de → Node.js**:

| Einstellung | Wert |
| --- | --- |
| Node.js-Version | 22 oder neuer |
| Anwendungsmodus | Production |
| Application Root | `/anydj.de` im Plesk-Webspace |
| Document Root | `/anydj.de/public` |
| Application Startup File | `index.js` |
| Node.js | aktivieren |
| HTTPS | gültiges Zertifikat für `anydj.de` aktivieren |

Neuere Plesk-Node.js-Toolkits können als Startdatei automatisch
`.plesk.startup.cjs` eintragen. Enthält diese Datei `require("./index.js")`, ist
das korrekt: Der von Plesk erzeugte Wrapper startet unsere Hauptdatei. Den
generierten Wrapper nicht überschreiben.

Plesk kann diese Pfade als relative Verzeichnisse oder als vollständige
Webspace-Pfade anzeigen. Entscheidend ist: Document Root ist das Unterverzeichnis
`public` der Application Root. Dort liegen nach dem Deploy direkt die HTML-, CSS-
und JavaScript-Dateien der Webanwendung. Plesk kann sie statisch ausliefern;
Passenger übernimmt unter anderem `/healthz`. Der Node.js-Server kann zusätzlich
die öffentlichen Dateien seines Releases ausliefern. `current.json`, Servercode,
alte Releases und Restart-Dateien liegen außerhalb der Document Root.

Keine Installation von Electron, Python-Modellen oder Projekt-`node_modules` auf
dem Webspace nötig. Das erzeugte Hosting-`package.json` hat keine Dependencies.
Den lokalen `server.mjs` für WiZ/DMX **nicht** als Plesk-Startup-Datei verwenden.
Die öffentliche App ist die Browserausgabe; sie erhält keine Geräte- oder
Analyse-APIs des lokalen Rechners.

Aufruf von `https://anydj.de/healthz` startet eine schlafende App und liefert
`app: "anydj"`, Release-ID und Instanz-ID. `npm run deploy:restart` prüft das
ebenfalls. Der erstmalige Plesk-Schalter und die Domain-/TLS-Konfiguration können
nicht allein durch FTP-Zugangsdaten gesetzt werden.

## Auto-Start und Neustart

Plesk/Passenger startet die aktivierte Anwendung bei einer Anfrage automatisch,
auch nach einem Serverneustart oder Prozessabsturz. Das ist Start bei Bedarf,
kein zusätzlicher dauerhaft laufender PM2-Prozess. Ein Deploy-Healthcheck löst
diesen Start unmittelbar aus. Ohne Passenger oder einen anderen Prozessmanager
startet ein beendetes `node index.js` nicht selbst neu.

```sh
npm run deploy:restart             # Passenger über tmp/restart.txt
npm run deploy:restart -- --crash   # gewünschter globaler Node.js-Fehler
```

Die Crash-Variante ruft zuerst `/healthz` auf und schreibt anschließend einen
zufälligen Wert nach `tmp/anydj-crash-restart`. Die laufende App erkennt die Änderung
und wirft außerhalb jeder Request-/Promise-Fehlerbehandlung einen **unbehandelten
globalen Error** (`ANYDJ_REQUESTED_RESTART`). Node.js beendet sich; Passenger
startet für die nächste Anfrage eine neue Instanz. Der neue Prozess übernimmt den
aktuellen Marker als Ausgangswert: kein Neustart im Kreis. Der Befehl wartet auf
eine geänderte Instanz-ID. Kein öffentlicher HTTP-Endpunkt kann den Crash auslösen.

Normale Deployments nutzen `tmp/restart.txt`, sodass Passenger auch eine vorher
schlafende oder fehlerhafte Anwendung neu laden kann. Das Panel „Restart App“
bleibt ebenfalls verwendbar. `--skip-health` überspringt lediglich die abschließende
Prüfung; ein Crash-Restart benötigt weiterhin den anfänglichen Healthcheck.

## Releases und Rollback

Der Build liegt in `dist/hosting/`. Hochgeladen werden nur die Web-Ausgabe, ein
kleiner Node.js-Webserver, der Bootstrap und das minimale Hosting-Paket.

```text
/anydj.de/
  index.js
  package.json
  current.json
  previous.json
  public/                  ← Plesk Document Root: aktuelle Webdateien
  releases/<release-id>/
    server.mjs
    public/                ← Sicherung der Webdateien für Rollbacks
  tmp/
    restart.txt
    anydj-crash-restart
```

Jeder Upload verwendet eine eigene Release-ID. Zuerst wird die vollständige
Release-Sicherung übertragen. Anschließend werden die öffentlichen Dateien in
einem temporären Verzeichnis vorbereitet und durch Verzeichnis-Renames als
`public/` aktiviert. Erst dann wird `current.json` ersetzt. Fremde Dateien in
`public/`, beispielsweise `.htaccess` und Dateien unter `.well-known`, bleiben
erhalten; entfernte Dateien des bisherigen Releases werden nicht mitgenommen.
Der Build prüft, dass `public/` und Release-Sicherung identisch sind.

FTP muss `MLSD` sowie Datei- und Verzeichnis-Renames unterstützen. Der Austausch
der Verzeichnisse benötigt zwei Rename-Befehle; dazwischen kann eine kurze
Unterbrechung entstehen. Schlägt die Aktivierung oder das Umschalten des Manifests
fehl, wird der vorherige Public-Ordner soweit die Verbindung verfügbar ist wieder
hergestellt. Ein harter Verbindungs-/Prozessabbruch während des Austauschs kann
eine manuelle Wiederherstellung aus `tmp/public-backup-*` erfordern.

Nach erfolgreichem Healthcheck werden alte Release-Verzeichnisse automatisch
gelöscht. Es bleiben das aktive Release, das in `previous.json` referenzierte
Rollback-Ziel und die neueste weitere vollständige Version erhalten (höchstens
drei). Unvollständige alte Uploads werden dabei ebenfalls entfernt. Fremde
Verzeichnisse ohne das AnyDj-Release-Namensformat werden nicht angefasst;
Symlinks oder unbekannte Dateitypen führen zum Abbruch der Bereinigung.

Bei HTTP-Fehlern wie 404, fehlendem `publicUrl` oder `--skip-health` findet keine
Release-Bereinigung statt. Vor dem Löschen werden der Healthcheck wiederholt und
das aktive Manifest unter der Deploy-Sperre erneut geprüft. Ein paralleler Deploy
kann dadurch nicht versehentlich das inzwischen aktive Release verlieren.

```sh
npm run deploy:rollback    # stellt Server UND public/ aus previous.json wieder her
```

Ein fehlgeschlagener Upload vor der Aktivierung lässt `current.json` unverändert.
Ein Fehler beim anschließenden Restart oder Healthcheck kann nach erfolgter
Aktivierung auftreten: Ausgabe prüfen und bei Bedarf Rollback ausführen. Ein
Healthcheck-Fehler löst kein automatisches Zurückrollen aus, weil beim ersten
Deployment die Plesk-Einrichtung noch fehlen kann.

`tmp/deploy.lock` verhindert parallele Deployments. Nach hartem Abbruch kann die
leere Sperrmappe übrig bleiben. Nur wenn kein Deploy mehr läuft, diese eine Mappe
im FTP-Client entfernen. Nach einem harten Abbruch können außerdem temporäre
`tmp/public-stage-*`- oder `tmp/public-backup-*`-Verzeichnisse übrig bleiben; diese
erst nach Prüfung der aktiven Webdateien aufräumen. Fremde Dateien werden nicht
automatisch gelöscht.

## Prüfen

```sh
node --test test/hosting.test.mjs test/deploy-health.test.mjs
python3 -m unittest discover -s test -p 'deploy_test.py'
```

Für Spotify im Developer Dashboard anschließend
`https://anydj.de/spotify-callback.html` registrieren.

Quellen: [Plesk Node.js](https://docs.plesk.com/en-US/obsidian/customer-guide/nodejs-support.76652/),
[Passenger-Neustarts](https://www.phusionpassenger.com/docs/advanced_guides/troubleshooting/standalone/restart_app.html).

## Website und vollständige Desktop-Apps gemeinsam veröffentlichen

```sh
npm run deploy:full
```

Dieser Befehl baut auf dem aktuellen **Linux-x64- oder Windows-x64-Rechner**
zuerst die KI-Laufzeiten und Modelle, dann die nativen Installer, erzeugt
SHA-256-Prüfsummen und baut die Website mit der eigenständigen Seite
`/downloads.html`. Anschließend folgt der bestehende FTPS-Upload mit
Aktivierung, Passenger-Neustart, Healthcheck und Release-Bereinigung.
Die Startseite und das DJ-Pult verlinken die Downloadseite.

Auf dem Build-Rechner müssen `npm ci`, die drei Analyseumgebungen einschließlich
PyInstaller und die Modellgewichte eingerichtet sein; siehe
[Desktop-Build](../desktop/README.md). Endnutzer benötigen diese Vorbereitung nicht.
Ein Fehler stoppt den Ablauf; es wird niemals automatisch eine Lite-Version gebaut.

```sh
# Vorhandene KI-Laufzeiten wiederverwenden; App und Installer werden neu gebaut:
npm run deploy:full -- --reuse-analysis

# Alles lokal vorbereiten, ohne Veröffentlichung (Build-Werkzeuge können Downloads benötigen):
npm run deploy:full -- --reuse-analysis --dry-run

# Bereits gebaute Pakete prüfen, Website bauen und veröffentlichen:
npm run deploy:full -- --skip-desktop-build
```

`--config /pfad/deploy.json` wählt alternativ die FTP-Konfiguration. Die üblichen
Befehle `npm run deploy:check` und `npm run deploy:rollback` bleiben verfügbar.
Ein normales `npm run deploy` veröffentlicht nur die Website und erhält die
bereits veröffentlichten Desktop-Downloads unverändert.

### Linux und Windows auf derselben Downloadseite

1. Auf Linux `npm run release:desktop` ausführen: erzeugt AppImage und .deb.
2. Auf Windows `npm run release:desktop` ausführen: erzeugt den vollständigen
   .exe-Installer. Native Windows-Analyseumgebungen sind Voraussetzung; dieser
   vollständige Windows-Build ist noch nicht validiert.
3. Den gesamten Ordner `.build/desktop-downloads/win32-x64/` einschließlich
   `manifest.json` auf den Deploy-Rechner in denselben relativen Pfad kopieren.
   Dort bleibt `.build/desktop-downloads/linux-x64/` ebenfalls liegen.
4. `npm run deploy:full -- --skip-desktop-build` veröffentlicht beide Plattformen.

Es werden nur Installer aus diesen Manifesten aufgenommen. Größe und SHA-256
werden vor dem Website-Build geprüft; manipulierte oder unvollständige Releases
stoppen den Build. Nicht vorhandene Plattformen erscheinen ohne Downloadbutton.
Die bereitgestellten Ordner müssen für spätere vollständige Deployments aufbewahrt bzw.
von den Build-Rechnern übernommen werden: Der Upload enthält genau den lokalen
Release-Bestand und übernimmt keine alten Installer automatisch vom Webserver.

Downloads sind große Dateien. Nur das vollständige Hostingpaket hält sie in `public/` und in der
Release-Sicherung; auch auf dem Server bleiben die Rückfall-Releases erhalten.
Entsprechend mehrere Gigabyte Speicher und ausreichend Upload-Zeit einplanen.
Upload, Rollback und Node-Auslieferung verwenden Streams bzw. temporäre Dateien;
Node unterstützt Byte-Range-Requests zum Fortsetzen. Falls Plesk statisch ausliefert,
muss der Webserver `.AppImage`, `.deb` und `.exe` als Downloads zulassen.

## Website deployen ohne Desktop-Builds

```sh
npm run deploy:web
```

Bereitet die Website mit den aktuellen Quellen vor und veröffentlicht über die
bestehende FTPS-Konfiguration. Baut weder Desktop-Installer noch KI-Laufzeiten.
Veröffentlichte Installer bleiben auf dem Server erhalten. Die Downloadseite wird
mit der aktuellen Vorlage neu erstellt; nur die veröffentlichten Downloadkarten
mit Links, Größen und Prüfsummen werden aus der bisherigen Seite übernommen. Das Downloadverzeichnis wird dort umbenannt, ohne die Pakete herunter-
oder hochzuladen. Lokale Installer werden weder geprüft noch in das Hostingpaket
kopiert. `npm run deploy` verhält sich genauso. Die übrigen Webdateien werden komplett
übertragen. Beim ersten Deployment ohne vorhandene Downloads erscheint ein
Verfügbarkeitshinweis ohne Downloadlinks.

Neue Installer samt Downloadkarten veröffentlichen:

```sh
npm run deploy:full
# Oder bereits gebaute Installer inklusive aktualisierter Downloadseite:
npm run deploy -- --with-downloads
```

Ein Rollback auf ein Website-Release behält die aktuell veröffentlichten Downloads
und ihre Seite bei. Ein Rollback auf ein vollständiges Release stellt auch dessen
Downloads wieder her und kann deshalb große Dateien übertragen.

Wenn wirklich kein Build-Schritt laufen soll:

```sh
npm run deploy:web -- --skip-build
```

Verwendet unverändert das zuvor mit `npm run build:hosting` vorbereitete
`dist/hosting`. Neuere Quelländerungen werden dabei nicht übernommen. Ohne
vorbereitetes Paket oder bei abweichendem Download-Modus wird abgebrochen.
Alte Hostingpakete einmal ohne `--skip-build` neu erzeugen. Vorab ohne Serververbindung prüfen:

```sh
npm run deploy:web -- --skip-build --dry-run
```

`--config /pfad/deploy.json` ist wie beim bestehenden Deploy verfügbar.
Hardwareempfehlungen und tatsächliche Funktionsgrenzen stehen auf der
Downloadseite unter `downloads.html#systemanforderungen`. Die empfohlene
KI-Zielklasse ist keine gemessene Mindesthardware.
