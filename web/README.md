# AnyDj auf statischem Webspace

```sh
npm run build:web
npm run preview:web
```

Vorschau: `http://127.0.0.1:4173`. Der Vorschau-Server ist nur ein lokales
Entwicklungswerkzeug. Für die öffentliche Seite genügt normaler HTTPS-Webspace.

Den **Inhalt** von `dist/web/` per SFTP oder über die Hosting-Verwaltung
hochladen. `index.html` ist die Startseite, `dj.html` die Anwendung. Auch ein
Unterordner wie `https://example.org/anydj/` funktioniert. Keine Rewrite-Regeln,
Datenbank, Python-Modelle, Node.js-Server oder API-Zugänge nötig. Der Webserver
muss `.js` als JavaScript ausliefern; Worker-Dateien dürfen nicht durch eine
HTML-Fallbackseite ersetzt werden. Die Dateien über HTTP(S) öffnen, nicht per
Doppelklick als `file://`.

## Funktionen

- Zwei Decks, Audio-Crossfader, Auto-Crossfade und Warteschlange.
- Analyse des Audiosignals lokal im Browser, ohne KI-Downloads oder Uploads.
- Farbmodi, eigene Paletten, editierbare Abschnitte und berechnete Lichtvorschau.
- Zwei im Browser synthetisierte Demo-Tracks zum direkten Ausprobieren.
- Separate Web-Demo-Bibliothek in IndexedDB; Einstellungen und Analyseergebnisse
  bleiben lokal. Audiodateien werden nicht in IndexedDB abgelegt. Nach einem
  Neustart ggf. erneut auswählen; gespeicherte Ordnerfreigaben hängen vom Browser ab.
- Audiodateien bis 50 MiB und 15 Minuten, soweit der Browser das Format decodiert.

Kein direkter WiZ-UDP-Zugriff, keine WLAN-Wiederverbindung, keine KI-Beat-/Stil-/
Instrumenten-/Strukturanalyse. Auto Beat ist deshalb deaktiviert. Die
Browseranalyse wird als eigene Betriebsart ausgewiesen; bewusst nicht
enthaltene KI-Funktionen erzeugen keine Teilanalyse-Warnung.

Die Informationsseiten laden Schriftarten und Bilder lokal. Optionales Google
Analytics wird ausschließlich nach Einwilligung geladen; ohne Mess-ID bleibt es
deaktiviert. Die DJ-Demo und OAuth-Callbacks werden nicht durch Analytics erfasst.
Siehe [Datenschutz und Analytics](#datenschutz-und-google-analytics).

## Prüfung

```sh
node scripts/check-web.mjs
```

Der Entwicklertest verwendet lokales Chrome und prüft Unterordner-Hosting,
beide Demo-Tracks, Audio-Wiedergabe, Farbvorschau, Warteschlange, Wiederherstellen
des Analyse-Caches, Mobilansicht sowie null API-Anfragen und null Uploads.
Screenshots entstehen unter `/tmp/anydj-web-*.png`.

## Spotify

Die Bibliothek besitzt einen optionalen Spotify-Tab für Playlists, Lieblingssongs
und Titelsuche. Nach einmaliger Einrichtung der Client ID und Redirect URI kann
sich jeder freigegebene Nutzer mit seinem Konto anmelden. Siehe
[Spotify-Einrichtung](../SETUP.md#spotify-in-der-dj-bibliothek).
`spotify-callback.html` muss mit hochgeladen werden. Erst nach expliziter Anmeldung
werden Spotify-APIs verwendet. Spotify-Premium-Wiedergabe ist in den Decks
verfügbar; die gemeinsame Warteschlange unterstützt lokale und Spotify-Titel.
Spotify-Titel werden ohne Crossfade gewechselt und nicht für Live-Lichtanalyse,
KI oder Aufnahme verwendet. Bestehende Kontoverbindungen einmal neu anmelden.

## Desktop-Downloadseite

`downloads.html` ist eine eigenständige, von Startseite und DJ-Pult verlinkte Seite.
Der Web-Build mit `npm run build:web -- --with-downloads` übernimmt vollständige
Installer aus `.build/desktop-downloads/`
nach Prüfung der Release-Manifeste und SHA-256-Prüfsummen. Ohne Paket zeigt die
jeweilige Plattform einen Verfügbarkeitshinweis ohne Downloadlink. Mit Paket
enthält die Seite Größe, Prüfsumme und Installationshinweise. Downloads sind
relativ verlinkt und funktionieren auch beim Hosting in einem Unterordner.

Kompletter Ablauf: `npm run deploy:full`; siehe [Deployment](../builder/README.md).

## Gestaltung und Produktvorschau

Startseite und Downloads teilen ein responsives, dunkles Layout mit mintfarbenen
Akzenten. Die Startseite zeigt das echte DJ-Pult aus der Browser-Demo;
`product-preview.webp` wird mit dem Web-Build ausgeliefert. Die Downloadseite
zeigt ausschließlich verifizierte, vorhandene Installer als Download an.

```sh
npm run build:web
node scripts/check-site.mjs
```

Prüft beide Seiten bei 1440, 768, 390 und 320 Pixel Breite, Bild, Navigation,
FAQ und Verfügbarkeit der Pakete. Screenshots: `/tmp/anydj-site-*.png`.
Nach Änderungen am DJ-Pult kann die echte Produktaufnahme erneuert werden:

```sh
node scripts/check-site.mjs --capture-product
npm run build:web
```

Die Aufnahme verwendet nur die synthetischen Demo-Tracks. Die Seiten benötigen
keine externen Schriften, Bilddienste oder zusätzlichen JavaScript-Bibliotheken.

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

## Datenschutz und Google Analytics

`impressum.html` und `datenschutz.html` werden mit dem gemeinsamen Header und
Footer gebaut. Die Betreiberangaben sind die bestätigten Angaben von Animatus
Erik Heldt in Lübeck. Die Datenschutzerklärung beschreibt Netcup-Webhosting und
E-Mail-Empfang, Serverprotokolle, Einwilligungsverwaltung, Google Analytics 4,
lokale DJ-Daten, Spotify/TIDAL, Kontakt und Betroffenenrechte.

### Mess-ID konfigurieren

In `web/analytics-config.json` die öffentliche GA4-Mess-ID eintragen:

```json
{"measurementId": "G-XXXXXXXXXX"}
```

Eine leere Zeichenfolge deaktiviert Analytics vollständig. Alternativ überschreibt
die Umgebungsvariable die Datei für den jeweiligen Build:

```sh
ANYDJ_GA_MEASUREMENT_ID=G-XXXXXXXXXX npm run build:web
ANYDJ_GA_MEASUREMENT_ID=G-XXXXXXXXXX npm run deploy:web
# Explizit deaktivieren, auch wenn die Datei eine Mess-ID enthält:
ANYDJ_GA_MEASUREMENT_ID= npm run build:hosting
```

`G-XXXXXXXXXX` ist nur ein Beispiel, kein produktiver Datenstrom. Ungültige Werte
brechen vor dem Löschen des bisherigen Web-Builds ab. Die Konfiguration ist
öffentlich; hier niemals API-Secrets oder Zugangsdaten eintragen. Änderungen
benötigen einen neuen Build und ein Deployment. `--skip-build` verwendet weiterhin
die zuvor gebaute Konfiguration. Der Build schreibt `analytics-config.js` in die
Web-Ausgabe; die Desktop-App erhält keine Analytics-Einbindung.

### Einwilligung und Datenumfang

- Basic Consent Mode: kein Google-Skript, kein Google-Request und keine cookielosen
  Pings vor Zustimmung oder nach Ablehnung. Ohne konfigurierte ID erscheint kein
  automatisches Einwilligungsbanner; die Einstellungen bleiben zugänglich.
- Gleich gestaltete Schaltflächen „Nur notwendige“ und „Analytics erlauben“.
  Die Entscheidung liegt mit Zeitstempel, Fassung und Mess-ID für 180 Tage im
  Local Storage (`anydj-privacy-v1`). Bei neuer Mess-ID/Fassung ist sie ungültig.
- „Cookie-Einstellungen“ steht auf allen Informationsseiten und in der Web-Demo.
  Ablehnen nach Zustimmung setzt sofort das Disable-Flag, löscht erreichbare
  `_ga`-Cookies und lädt eine zuvor messende Informationsseite neu, um den
  Google-Code zu entladen. Die DJ-Demo lädt dabei nicht neu; Audio bleibt erhalten.
  Änderungen werden über `storage` zwischen Tabs sowie beim Wiederanzeigen und
  nach Ablauf abgeglichen. Blockierter oder ungültiger Speicher erlaubt kein Tracking.
- Messung nur auf Startseite, Downloads, Impressum und Datenschutz. Keine
  Einbindung in DJ-Demo, OAuth-Callbacks oder Desktop-App. Seitenadresse ohne
  Query/Fragment, leerer Referrer, keine eigenen Musik-, Konto- oder Suchereignisse.
- Google-Signale, Anzeigenpersonalisierung und alle drei Werbe-Einwilligungen
  deaktiviert. Hostgebundene Analytics-Cookies gelten höchstens 180 Tage, ohne
  Verlängerung bei jedem Aufruf; der Cookie-Pfad folgt dem Hosting-Unterordner.
- Bei Änderungen von Zwecken, Anbietern oder Einwilligungstext auch `VERSION`
  in `web/privacy.js` erhöhen und Datenschutzerklärung aktualisieren.

### Einstellungen außerhalb des Website-Codes

Der Code kann die folgenden Einstellungen in den Netcup-/Google-Konten nicht
ändern. Sie müssen zur tatsächlichen Nutzung passen:

1. **Netcup:** AVV nach Art. 28 DSGVO im Kundenkonto vorhalten. Im Webhosting
   unter „Protokolle / Protokoll-Rotation“ tatsächliche Logfelder, Rotation,
   Löschfrist und eventuelle Backups prüfen. Es gibt keine universelle gesetzliche
   Aufbewahrungsfrist für Webserver-Logs. Die Datenschutzerklärung nennt deshalb
   Zweck- und Löschkriterien, keine erfundene Tageszahl. Die konkreten Einstellungen
   wurden nicht über das Panel geprüft; die festgestellte Frist anschließend im
   Hosting-Abschnitt ergänzen. Netcups Frist für die eigene Website ist kein Beleg
   für die Frist dieses Webspaces. Zusätzliche Plesk-Webstatistiken prüfen.
2. **Google Analytics:** Bedingungen zur Auftragsverarbeitung akzeptieren,
   Datenfreigaben auf das Erforderliche beschränken, Google-Signale und
   Werbeverknüpfungen ausschalten. **Erweiterte Messung im Web-Datenstrom
   ausschalten**, damit keine zusätzlichen Formular-, Such-, Link- oder
   Downloadereignisse außerhalb der hier beschriebenen Messung entstehen.
   Automatische Seitenaufrufe stammen aus der Code-Konfiguration.
3. **Aufbewahrung bei Google:** zwei Monate einstellen und Zurücksetzen der
   Aufbewahrungsdauer bei neuer Aktivität deaktivieren. Der Cookie-Zeitraum ist
   eine andere Einstellung. Solange kein produktiver Datenstrom feststeht,
   beschreibt die Erklärung die GA4-Standardoptionen zwei/14 Monate und die
   getrennte Aufbewahrung aggregierter Berichte. Nach Einrichtung durch die
   tatsächliche Einstellung ersetzen. Keine unbestätigte Kontoeinstellung wird
   durch das Eintragen der Mess-ID automatisch vorgenommen.
4. **Hosting-Sicherheitsrichtlinien:** Der Node-Server erlaubt die erforderlichen
   Google-Tag- und Analytics-Adressen in seiner CSP. Falls Plesk die Dateien
   direkt ausliefert und eigene CSP-Header setzt, diese entsprechend abgleichen;
   keine pauschalen Freigaben für beliebige Skripte oder `unsafe-eval` nötig.

Hosting und E-Mail über Netcup wurden vom Betreiber bestätigt. Die genauen
Aufbewahrungseinstellungen und Vertragsunterlagen sind nicht aus dem Quellcode
nachprüfbar. Die Texte ersetzen keine individuelle rechtliche Prüfung der
betrieblichen Verarbeitung und der Verträge.

### Prüfen

```sh
npm run build:hosting
node scripts/check-privacy.mjs
node scripts/check-site.mjs
node scripts/check-web.mjs
node --test test/hosting.test.mjs
```

Der Datenschutz-Browsertest nutzt eine ausschließlich im Testserver eingesetzte
Mess-ID und fängt Google-Anfragen ab. Es werden keine Testdaten an Google gesendet.
Er prüft fehlende/ungültige/abgelaufene Einwilligung, Ablehnen, Zustimmen,
Widerruf und Cookie-Löschung, mehrere Tabs, blockierten Speicher, fehlende Mess-ID,
Unterordner, Mobilansicht sowie den Ausschluss der Demo und OAuth-Callbacks.

### Quellen für den Abgleich (25.09.2026)

- [DSGVO](https://eur-lex.europa.eu/eli/reg/2016/679/oj?locale=de)
- [§ 25 TDDDG](https://www.gesetze-im-internet.de/ttdsg/__25.html)
- [Netcup-Impressum](https://www.netcup.com/de/kontakt/impressum)
- [Netcup-Auftragsverarbeitung](https://www.netcup.com/de/helpcenter/dokumentation/general/avv)
- [Netcup-Protokollverwaltung](https://www.netcup.com/de/helpcenter/dokumentation/webhosting/interface)
- [Google Basic Consent Mode](https://support.google.com/analytics/answer/10000067?hl=de)
- [GA4-Konfiguration](https://developers.google.com/analytics/devguides/collection/ga4/reference/config)
- [GA4-Aufbewahrung](https://support.google.com/analytics/answer/7667196?hl=de)
- [Google-Datenübermittlungen](https://policies.google.com/privacy/frameworks?hl=de)
- [Spotify-Datenschutz](https://www.spotify.com/de/legal/privacy-policy/)
- [TIDAL-Datenschutz](https://tidal.com/privacy)

Header und Footer werden aus `web/header.html` und `web/footer.html` eingesetzt.
Web-Deployments übernehmen nur die veröffentlichten Downloadkarten aus der
bisherigen Seite; Datenschutz- und Cookie-Elemente stammen aus der neuen Vorlage.
Installer bleiben auf dem Server erhalten.
