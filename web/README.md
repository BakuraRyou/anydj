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

Die Startseite nutzt keine externen Schriftarten, Tracker oder eingebetteten
Dienste. Der Hoster kann unabhängig davon normale Zugriffsprotokolle führen.
Die Seite ist vorbereitet, wurde aber nicht auf einem öffentlichen Server
veröffentlicht. Betreiberangaben und vorhandene Website-Navigation können beim
Einbinden ergänzt werden.

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

## Rechtstexte

`impressum.html` und `datenschutz.html` werden vom Web-Build übernommen und sind
auf Startseite, Downloadseite und in der Web-Demo verlinkt. Die Links im Pult
öffnen einen neuen Tab, um die laufende Audio-Sitzung zu erhalten.

Stand 23.09.2026 ist das Impressum mit den bestätigten Betreiberangaben ergänzt.
Die Datenschutzerklärung bleibt ein **Entwurf** mit sichtbaren Platzhaltern und
`noindex`. Betreibername (Animatus Erik Heldt, Inhaber Erik Heldt), E-Mail,
USt-IdNr. und Erklärung zur Verbraucherstreitbeilegung wurden aus dem vom Nutzer
benannten [Animatus-Impressum](https://www.animatus.de/impressum) übernommen.
Die Quellen widersprechen sich bei Anschrift und Telefon:

- Impressum: Braunstraße 6, 23552 Lübeck; +49 451 50498827.
- [Datenschutzerklärung](https://www.animatus.de/datenschutz), Stand 29.11.2023:
  Traberstieg 13, 22941 Bargteheide; +49 4532 2650084.

Der Nutzer hat ausdrücklich die Lübecker Angaben aus dem Impressum bestätigt.
Diese Anschrift ist in beiden Rechtstexten eingetragen; die Telefonnummer ist
im Impressum direkt anklickbar.
Der veraltete OS-Plattform-Verweis wurde nicht übernommen:
[Die Plattform wurde am 20.07.2025 eingestellt](https://consumer-redress.ec.europa.eu/site-relocation_en).
Vor Veröffentlichung fehlen außerdem Hosting-/E-Mail-Anbieter, tatsächliche
Logdaten und Löschfristen sowie gegebenenfalls Angaben zu Datenschutzbeauftragten.
Die fremde Website-Datenschutzerklärung ist kein Nachweis dafür, welche
Dienste AnyDj tatsächlich nutzt; ihre Diensteliste wurde nicht übernommen.

Die Beschreibung der Demo basiert auf dem Quellcode: lokale Audioverarbeitung,
Local Storage/IndexedDB sowie optionale Spotify-/TIDAL-Verbindungen mit Tokens
im Session Storage. Die Erforderlichkeit der einzelnen Speicherzugriffe und die
Einbindung der Streaming-Dienste müssen mit den tatsächlich eingesetzten
Rechtsgrundlagen und gegebenenfalls einer Einwilligungssteuerung abgeglichen
werden. Die Rechtstexte selbst implementieren keine Einwilligungssteuerung.
Zusätzliche Dienste des Hosters sind im Quellcode nicht erkennbar.

Nach Ergänzung und Prüfung die Entwurfsnotiz, alle Platzhalter und das
`noindex`-Metaelement entfernen. Die Footer-Links bleiben erhalten. Beim
Web-only-Deployment wird auch die Downloadseite aktualisiert; bestehende
Downloadkarten und Installer bleiben erhalten.

Geprüfte Grundlagen und Anbieterinformationen:

- [§ 5 DDG – Anbieterkennzeichnung](https://www.gesetze-im-internet.de/ddg/__5.html)
- [DSGVO, insbesondere Art. 6, 13 und 15–22](https://eur-lex.europa.eu/eli/reg/2016/679)
- [§ 25 TDDDG – Endgerätespeicherung](https://www.gesetze-im-internet.de/ttdsg/__25.html)
- [§ 36 VSBG – Verbraucherstreitbeilegung](https://www.gesetze-im-internet.de/vsbg/__36.html)
- [Spotify Datenschutz](https://www.spotify.com/de/legal/privacy-policy/)
- [TIDAL Datenschutz](https://tidal.com/privacy)

Header und Footer der Website werden beim Build aus `web/header.html` und
`web/footer.html` eingesetzt. Änderungen daran gelten für Startseite, Downloads,
Impressum und Datenschutz. Web-Deployments lesen nur die kleine veröffentlichte
Downloadseite zurück und übernehmen deren `download-grid`; Installer werden
weiterhin ausschließlich auf dem Server verschoben. Ein fehlender oder nicht
eindeutiger Downloadbereich bricht die Aktivierung ab, ohne die Live-Seite zu ändern.
