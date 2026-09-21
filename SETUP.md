# Experimentelle Einrichtung ohne AnyDj-App

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

## Lampeneinrichtung

Stand: 19.09.2026. Nur `ESP03_SHRGB1C_01`, Firmware `1.32.0`.
Geräteidentifikation, WLAN-Zugangsdatenübertragung, Abschluss und anschließende
UDP-Abfragen (getPilot, getSystemConfig, getModelConfig) wurden an der echten
Lampe erfolgreich bestätigt. Die Lampe wurde in der App gespeichert. Ein
Stromausfall-/Neustarttest der Lampe wurde nicht durchgeführt.

1. Lampe in den manuellen Einrichtungsmodus bringen (AnyDjConfig_…-WLAN).
2. Rechner mit diesem WLAN verbinden; eine parallele LAN-Verbindung erleichtert
   den anschließenden Heimnetztest. Die App schaltet selbst keine Netzwerke um.
3. `http://localhost:3030/setup` am Rechner öffnen und „Lampe prüfen“ wählen.
4. SSID und Passwort des 2,4-GHz-WPA2-Netzes lokal eingeben und übertragen.
5. Erst bei Gerätestatus 5 und gemeldeter IP wird „Einrichtung abschließen“ angeboten.
6. In der normalen Oberfläche suchen oder die gemeldete Heimnetz-IP hinzufügen.
   Erst eine dortige Statusantwort bestätigt die lokale Steuerbarkeit.

Keine Passwörter in Gerätedatei oder UDP-Historie. Die neuen API-Endpunkte sind
auf Loopback-Clients begrenzt, verwenden die bestehenden Host-/Origin-/Token-
und Schreibheader-Prüfungen und sind im Demo-Modus deaktiviert. Schreibanfragen
werden nach Timeout nicht automatisch wiederholt. Nach fehlgeschlagenem Versuch
ggf. Lampe erneut in den Einrichtungsmodus bringen und Server neu starten.

## Protokollnachweis

Untersuchte unveränderte Originalfirmware:
`http://firmware.wiz.world/firmwares/ESP03_SHRGB1C_01/1.32.0/wizlight.bin`

- DHCP: Rechner `192.168.56.100/24`, Lampe `192.168.56.1`.
- `GET /device` liefert `{mac,name,fw,status}`, bei Status 5 zusätzlich `ip`.
- `POST /pairing`: `offsets`, `enc_ssid`, `enc_pwd`, `iv`, `pwd`, `hid`, `env`, `reg`.
- `POST /complete`: Abschluss nach erfolgreichem WLAN-Beitritt.
- Handler `0x400e2ef4`, Statushandler `0x400e30c4`, Schlüsselableitung
  `0x400d8b44`, Entschlüsselung `0x400d8c20`.
- Offsets `[1,0]` wählen die ersten 16 Zeichen der ersten Base64-Zeile des öffentlichen Zertifikats (nach dem Header).
  MD5 als 32 ASCII-Hexzeichen ergibt den AES-256-CBC-Schlüssel; Base64 für IV
  und Ciphertext, PKCS#7-Padding. `pwd` ist ein angehängter Klartextsuffix und
  bleibt leer, da das vollständige Passwort in `enc_pwd` übertragen wird.
- `hid=0` lässt die Lampe ohne Cloud-Hauszuordnung; `env=pro`, `reg=eu`.
  Genau diese Kombination wurde erfolgreich getestet. Eine zufällige Haus-ID
  führte bei den vorherigen Versuchen nicht zu einer dauerhaft erreichbaren Lampe.

Keine offizielle API. Die Protokollverschlüsselung mit öffentlich ableitbarem
Schlüssel schützt nicht wie TLS. Übertragung im temporären offenen Lampen-WLAN.
Die Firmware kann nach dem Beitritt weiterhin Herstellerdienste kontaktieren;
die Webapp unterbindet das nicht. Andere Modelle/Firmware werden abgewiesen.

Die Einrichtungsschnittstelle kann nach dem WLAN-Test unter der neuen Heimnetz-IP erreichbar sein. Der Client merkt sich die vom identifizierten Gerät gemeldete IP und prüft Modell/MAC vor dem Abschluss erneut. Abschlussantwort vollständig lesen; anschließend lokale UDP-Erreichbarkeit prüfen.

## Automatische Wiederverbindung (ergänzt)

Der oben beschriebene manuelle Ablauf wird für die konfigurierte bekannte Lampe
nun durch `lib/recovery.mjs` automatisiert. Die Aussage „Die App schaltet selbst
keine Netzwerke um“ gilt nur noch für den manuellen Ablauf. Die Automatik nutzt
ein temporäres NetworkManager-Profil ohne Standardroute und Autoconnect; bei
Abschluss/Fehler wird es gelöscht und die vorherige Verbindung wieder aktiviert.
Zugangsdaten werden für diesen ausdrücklich aktivierten Modus lokal in
`data/recovery.json` mit Dateirechten 0600 gespeichert. Sie werden nicht über
Status-APIs zurückgegeben. Bestehende Einschränkung auf Modell/Firmware bleibt.

An der echten Lampe getestet: Einrichtungsnetz erkannt, Identität geprüft,
Heim-WLAN-Daten separat erfolgreich validiert, nach zunächst ausgebliebenem
Beitritt einmal kontrolliert wiederholt, Gerätestatus 1 → 5, Abschluss bestätigt,
UDP-Heimnetzverbindung unter 192.168.178.53 wiederhergestellt. Kein physischer
Stromzyklus getestet. Automatik für diese Lampe ist aktiviert.

## Wiederkehrender Einrichtungsmodus nach Stromunterbrechung

Der laufende Server prüft die ausdrücklich aktivierte, gespeicherte Lampe jetzt
auch ohne geöffnete Lampenseite. Nach jeder Prüfung wartet er 15 Sekunden;
laufende Musik, Suche und Pairing pausieren die Hintergrundprüfung. Bei einem
sichtbaren passenden AnyDjConfig-Netz folgen Netzwechsel, Identitätsprüfung,
Pairing, Abschluss, Rückkehr zum vorherigen WLAN und UDP-Prüfung automatisch.
Der WLAN-Scan fordert frische Ergebnisse an und erhält bis zu 12 Sekunden Zeit.
Der Verbindungsaufbau zum Lampen-WLAN darf einschließlich DHCP bis zu 60 Sekunden
dauern; die bisherige Grenze von 20 Sekunden brach beobachtete DHCP-Vorgänge ab.

Nach einer unklaren Pairing-Antwort bleibt der Auftrag gespeichert. Erst nach
dem gesamten Beitritts-Wartefenster und mindestens drei aufeinanderfolgenden
frischen Gerätestatusantworten mit Status 0 ist ein zweiter Versuch erlaubt.
Fehlgeschlagene Statusabfragen oder ein laufender Beitritt erlauben keine erneute
Übertragung. Pro Durchlauf sind maximal zwei Übertragungen vorgesehen. Nach einem
Fehler wartet die Automatik zwei Minuten; weitere Versuche erfordern erneut das
volle Wartefenster und frisch bestätigten Status 0. Ein alter Fehlversuch sperrt
damit spätere Wiederverbindungen nicht dauerhaft.
Ein abgeschlossener Auftrag blockiert den nächsten Einrichtungszyklus nicht.
Die automatische Prüfung benötigt einen laufenden Server; nach Codeänderungen
muss dieser neu gestartet werden.

## Start direkt beim Öffnen der DJ-Seite

Die DJ-Seite ruft `/api/connection` beim Laden auf, unabhängig von der
Musikbibliothek und ohne Play-Klick. Sie zeigt den Verbindungsfortschritt dauerhaft
an und prüft außerhalb einer laufenden Musiksession alle sieben Sekunden erneut.
Die zuletzt geprüfte Lampen-IP wird gespeichert und nach DHCP-Wechsel aktualisiert.

Die Einrichtung verwendet jetzt einen kurzen HTTP/1.1-Austausch mit explizitem
`Content-Length`, kanonischer Header-Schreibweise und `Connection: close` statt
des allgemeinen Fetch-Verbindungspools. Auch der vollständige Antwortkörper
unterliegt dem Timeout. Zugangsdaten werden im Transport nicht automatisch
wiederholt. Dies reduziert Unterschiede zu einfachen einzelnen HTTP-Anfragen;
eine Behebung des realen Pairing-Fehlers ist damit noch nicht nachgewiesen.

## Abgleich mit früheren erfolgreichen Verbindungen

Die damaligen Werkzeugläufe wurden mit der Implementierung abgeglichen;
Details stehen in [recovery-history-comparison.md](reports/recovery-history-comparison.md).
Die Automatik erhält nun auch die gespeicherte Heimnetz-IP als Statuskandidaten,
bevor der AP diese erneut meldet. Nach bestätigtem Beitritt erfolgt der Abschluss
bevorzugt im Heimnetz und nach zwei Sekunden Wartezeit. Eine bereits im Heimnetz
erreichbare HTTP-Einrichtung wird auch ohne UDP-Antwort oder sichtbares
Einrichtungs-WLAN fortgesetzt. Vor einem Pairing-Wiederholungsversuch wird die
AP-Verbindung frisch aufgebaut und die MAC erneut geprüft.

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
