# Einrichtung von AnyDj

## Lokale HTTPS-Entwicklung und Spotify

Einmalig [mkcert](https://github.com/FiloSottile/mkcert#installation) installieren.
Unter Debian/Ubuntu: `sudo apt install mkcert libnss3-tools`.

```sh
pnpm run dev:https
```

Beim ersten Start richtet mkcert eine lokal vertrauenswürdige Zertifizierungsstelle
ein (ggf. mit System-Passwort) und erstellt das Zertifikat in `.certs/`.
Danach wird es wiederverwendet. Browser nach der ersten Einrichtung ggf. neu starten.
Spotify erlaubt `localhost` auch mit HTTPS nicht; für die Anmeldung immer
`127.0.0.1` verwenden.
Die App unter **https://127.0.0.1:3030/dj** öffnen. Der Server startet bei Änderungen
an seinen Modulen automatisch neu; Frontend-Änderungen erscheinen nach Neuladen.
`pnpm run dev:https --demo` startet ohne echte Lampensteuerung.

In derselben Spotify-App zusätzlich diese Redirect URI exakt hinterlegen:

```text
https://127.0.0.1:3030/spotify-callback.html
```

Die produktive Redirect URI beibehalten. Lokal einmal separat bei Spotify anmelden;
Browser-Sitzung und Bibliothek gehören zur jeweiligen Adresse. Ein Deployment ist
für diese Tests nicht nötig. [Spotify-Vorgaben für Redirect URIs](https://developer.spotify.com/documentation/web-api/concepts/redirect_uri).

`PORT=3443 pnpm run dev:https` verwendet einen anderen Port; dann auch die Redirect
URI entsprechend eintragen. `pnpm run dev:cert` erneuert das lokale Zertifikat.
Eigene PEM-Dateien sind über `SSL_CERT_FILE` und `SSL_KEY_FILE` möglich (beide setzen).
Der HTTPS-Dev-Befehl bindet ausschließlich an `127.0.0.1`. `.certs/` wird von Git
ignoriert und gehört nicht zum Hosting-Paket. `pnpm run dev` bleibt der HTTP-Start.

## TIDAL-Bibliothek einrichten

In der Bibliothek den Tab **TIDAL → Verbindung** öffnen. Unter „Einmalige
Einrichtung“ die Client-ID einer eigenen App aus dem
[TIDAL Developer Dashboard](https://developer.tidal.com/dashboard) eintragen.
Kein Client Secret verwenden. Für eine zentrale Vorgabe kann die öffentliche
Konstante `TIDAL_CLIENT_ID` in `public/tidal-client.js` gesetzt werden; andernfalls
wird die Eingabe nur im lokalen Browser gespeichert.

Read-only-Berechtigungen: `user.read`, `collection.read`, `playlists.read`.
Die App muss diese Scopes erhalten dürfen. Folgende Redirect URIs für die jeweils
verwendete Umgebung registrieren (auch im Verbindungsdialog angezeigt):

- Lokal: `https://127.0.0.1:3030/tidal-callback.html`
- Hosting: `https://anydj.de/tidal-callback.html`

Anmeldung mit OAuth/PKCE; Tokens liegen im Sitzungsspeicher des Browsers und werden
bei Bedarf erneuert. Suche, Playlists, Lieblingssongs und Cover nutzen die
öffentliche JSON:API unter `https://openapi.tidal.com/v2/`. Der Länderparameter
stammt aus dem angemeldeten Profil (Fallback DE).

In dieser Basisintegration ist kein TIDAL-Streaming für die Decks freigeschaltet.
Über **Mehr → Datei zuordnen** lassen sich vorhandene eigene Dateien ausdrücklich
zuordnen und anschließend einzeln oder gesammelt einreihen beziehungsweise auf
Deck A/B laden. Die Queue spielt dabei die lokale Datei. Zuordnungen gelten für
die Browsersitzung; erneutes Anmelden oder Trennen löscht sie. Bereits eingereihte
lokale Dateien bleiben erhalten. Es werden keine TIDAL-Musikdateien heruntergeladen
oder an unseren Server übertragen.

Bei 403 die App-/Scope-Freigabe prüfen; 429 wird mit einer Wartezeit angezeigt.
Ohne eigene App-ID und echte Anmeldung ist nur der simulierte Integrationstest
möglich. Die DJ-Integrationsauswertung steht in
[reports/tidal-integration-evaluation.md](reports/tidal-integration-evaluation.md).

## WLAN-Lampen

Lampen müssen bereits im Heimnetz eingerichtet sein. AnyDj kann sie dort per
UDP finden und steuern; alternativ lässt sich ihre IP manuell hinzufügen.
WLAN-Scans, WLAN-Einrichtung und automatische Netzwechsel wurden entfernt.
AnyDj erstellt keine NetworkManager-Verbindungsprofile mehr. Die bisherigen
Einrichtungsseiten und `/api/setup/*`-Endpunkte sind nicht mehr verfügbar.
Alte Dateien `data/recovery.json` und `data/recovery-pending.json` werden nicht
mehr gelesen. Bereits angelegte Netzwerkprofile bleiben im Betriebssystem
bestehen. Nach dem Update den laufenden App-Server neu starten.

## DMX über USB und LAN

Die lokale App spricht mit einem **separat installierten OLA-Dienst** auf
`127.0.0.1:9090`. OLA übernimmt die USB-Treiber bzw. Art-Net/sACN-Ausgabe.
Ohne OLA funktionieren Lichtshow und Simulation weiterhin.

1. [OLA installieren und starten](https://www.openlighting.org/ola/getting-started/using-ola/).
   Betriebssystem, Interface und dessen OLA-Plugin müssen zusammenpassen.
   Der Dienst ist nicht im Desktop-Paket enthalten; insbesondere ein Windows-
   Desktop-Paket bedeutet nicht automatisch, dass OLA unter Windows verfügbar ist.
2. In OLA die benötigten Plugins aktivieren. USB: unterstütztes Interface
   anschließen und gegebenenfalls Geräteberechtigungen/Treiber einrichten.
   LAN: Netzwerkinterface, Art-Net-/sACN-Ausgang, Ziel und Netzwerkuniversum
   in OLA konfigurieren. Hotplug-Verfügbarkeit hängt vom jeweiligen Plugin ab.
3. AnyDj im normalen lokalen Modus öffnen, Lichtbühne aktivieren und unter
   „Bühne einstellen“ die vorhandenen Geräte/Segmente anlegen.
4. An jedem Gerät DMX-Startadresse und Kanalmodus entsprechend der Tabelle
   „Kanalbelegung & technische Details“ einstellen: Scheinwerfer =
   Dimmer/R/G/B, Leisten = R/G/B je Segment. Andere Herstellerbelegungen
   benötigen noch passende Geräteprofile und funktionieren nicht automatisch.
5. Unter „Echte Lampen verbinden“ den automatisch erkannten Ausgang wählen,
   Musik starten und „DMX-Ausgabe einschalten“ drücken.

AnyDj verwendet einen Ausgang mit einem exklusiven OLA-Universum. Ungebundene
Ausgänge erhalten automatisch ein freies Universum ab 100; bestehende exklusive
Zuordnungen werden übernommen. Die OLA-Zuordnung bleibt nach dem Ausschalten
erhalten. Universen mit zusätzlichen Ein- oder Ausgängen werden abgelehnt.
Das OLA-Universum ist nicht zwingend die Art-Net-/sACN-Universumsnummer.
Andere Sender sollten dasselbe Universum nicht gleichzeitig beschreiben.

Es wird die Verfügbarkeit des Interfaces/OLA-Ausgangs erkannt, nicht der
einzelnen DMX-Scheinwerfer. RDM-Geräteerkennung ist nicht implementiert.
„LAN verfügbar“ bestätigt keine Verbindung zum entfernten Empfänger.
USB/lokal ist eine Gruppierung von OLA-Ausgängen, kein Nachweis eines USB-Kabels.
Mehrere Lampen an einem Ausgang sind möglich; mehrere unabhängige Ausgänge
oder Universen gleichzeitig werden derzeit nicht unterstützt.

Die Verbindung wurde ohne physische Hardware mit simulierten Geräten geprüft.
Vor dem ersten Einsatz mit Hardware müssen Kanalbelegung, Netzwerkzuordnung
und Abschaltverhalten am konkreten Interface geprüft werden.

## Spotify in der DJ-Bibliothek

Unter **Bibliothek → Spotify → + Verbinden** lässt sich ein Spotify-Konto anbinden.
AnyDj zeigt Playlists, Lieblingssongs, Suchergebnisse und Cover. Ein Klick auf eine
Playlist öffnet deren Titel in AnyDj; externe Spotify-Links stehen unter „Mehr“.
Spotify-Titel können direkt in ein Deck geladen oder mit lokalen Titeln in derselben
Warteschlange und in gespeicherten Listen kombiniert werden. Play/Pause, Position
und Lautstärke steuern den Spotify Web Playback SDK. Die Wiedergabe benötigt
Spotify Premium und einen Browser mit Unterstützung für geschützte Inhalte.
Bestehende Kontoverbindungen müssen für die neuen Wiedergabeberechtigungen einmal
neu angemeldet werden.

Bei Spotify erfolgt der Titelwechsel ohne Crossfade. Spotify-Audio gelangt nicht
in Web Audio, Aufnahme, Voranalyse oder Live-Lichtanalyse. Es werden keine
Bibliotheken oder Musikdateien auf dem AnyDj-Server gespeichert. Gemischte Listen
liegen im Browser; nach Neuladen startet keine Wiedergabe automatisch.
Über „Mehr → Datei zuordnen“ bleiben lokale Alternativen mit den Mixfunktionen
verfügbar. Vor dem Einreihen einer ganzen Playlist gegebenenfalls „Restliche Titel
laden“ wählen; „Alle einreihen“ übernimmt die geladenen Titel.

### Einmalige Einrichtung

1. Im [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) eine
   eigene App einrichten (Web API). Für Development Mode benötigt der App-Inhaber
   Spotify Premium; weitere Konten müssen dort als Nutzer freigegeben sein.
2. Die **Redirect URI** exakt in der Spotify-App hinterlegen.
   Für die Website: `https://anydj.de/spotify-callback.html`.
   Desktop: `http://127.0.0.1:36931/spotify-callback.html`. Browser: tatsächlicher
   Ursprung und Unterordner, beispielsweise
   `https://example.org/anydj/spotify-callback.html`.
3. Die AnyDj-Client-ID ist zentral in `public/spotify-client.js` hinterlegt und
   wird mit dem Web- und Hosting-Build ausgeliefert. Nutzer müssen keine ID
   eingeben. Kein Client Secret erforderlich.
4. „Mit Spotify anmelden“ wählen, das separate Fenster erlauben und Zugriff
   bestätigen. Die Decks werden dadurch nicht unterbrochen.

Spotify akzeptiert HTTP nur mit Loopback-IP (`127.0.0.1` oder `[::1]`), nicht mit
`localhost` oder einer LAN-IP. Für Webhosting HTTPS verwenden. Die Web-Ausgabe
enthält die Callback-Seite; bei eigenen Content-Security-Policy-Headern müssen
`connect-src`-Zugriffe auf `https://accounts.spotify.com` und
`https://api.spotify.com` erlaubt sein. Der SDK benötigt außerdem `script-src`
für `https://sdk.scdn.co`, Spotify-Frames sowie die Spotify-/scdn-/spotifycdn-
Verbindungs- und Mediendomains. Die vollständigen Header stehen in `server.mjs`
und `builder/hosting/server.mjs`; eigene Plesk-Header dürfen sie nicht verschärfen.

Die Anmeldung verwendet Authorization Code mit PKCE, zufälligem State und zehn
Minuten Gültigkeit. Anmeldetokens werden nur im Sitzungsspeicher des Hauptfensters
gehalten und bei Bedarf erneuert. Nach Ende der Fenstersitzung erneut verbinden.
Die Client ID ist öffentliche App-Konfiguration; bestätigte Zuordnungen liegen in IndexedDB
und sind für Web- und lokale Ausgabe getrennt. „Verbindung trennen“ entfernt die
Sitzung und die angezeigten Spotify-Inhalte, behält lokale Dateien, DJ-Listen und
Zuordnungen. Den erteilten Zugriff bei Bedarf zusätzlich in den
[Spotify-Kontoeinstellungen](https://www.spotify.com/account/apps/) widerrufen.

Für neue Development-Mode-Apps beschränkt Spotify Playlist-Inhalte auf eigene oder
kollaborative Listen. Fremde Listen können sichtbar sein, ohne dass ihre Titel
abrufbar sind. Suche lädt zehn Treffer pro Seite. Rate Limits, erschöpftes Kontingent,
fehlende Freigabe und abgelaufene Anmeldung erscheinen im Spotify-Tab. API-Inhalte
liegen in der aktuellen Ansicht im Arbeitsspeicher. Gespeicherte DJ-Listen enthalten
lokale Track-IDs beziehungsweise Spotify-IDs mit Titel, Künstler und Cover-Verweis;
sie werden ausschließlich im Browser gespeichert.

Spotify über die öffentliche API ist eine Quelle für unveränderte Wiedergabe und
Bibliotheksorganisation. Für eine breite Veröffentlichung ist
der Spotify-Entwicklungszugang allein nicht ausreichend; die jeweilige
App-Freigabe muss geklärt sein.

Referenzen: [PKCE](https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow),
[Redirect URIs](https://developer.spotify.com/documentation/web-api/concepts/redirect_uri),
[API-Migration](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide),
[Developer Policy](https://developer.spotify.com/policy).

## Netcup / Plesk deployen

`npm run deploy` baut die öffentliche Web-Version, überträgt ein vollständiges
Release per FTPS aus der JSON-Konfiguration `builder/ftp/.env` und startet die
Plesk-/Passenger-Anwendung neu. `npm run deploy:restart -- --crash` löst gezielt
den gewünschten globalen Node.js-Fehler aus; Passenger übernimmt den Folgestart.
Die erstmaligen Plesk-Einstellungen (Node.js 22+, App Root `/anydj.de`, Document
Root `/anydj.de/public`, Startup `index.js`) und alle Befehle stehen in der
[Deployment-Anleitung](builder/README.md). Für die erste Übertragung vor der
Plesk-Aktivierung `npm run deploy -- --skip-health` verwenden.
