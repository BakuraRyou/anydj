# Gekoppelte VR-Vorschau

## Ausprobieren

1. Backend/Desktop-App mit dem aktualisierten Code neu starten.
2. Am Rechner den Aufbau und die Musik wie bisher bearbeiten. Im 3D-Fenster **VR-Vorschau verbinden** öffnen und **Übertragung starten** anklicken.
3. Die passende Heimnetz-Adresse auswählen, **Adresse kopieren** und diese kurze Adresse im Headset-Browser öffnen. Dort den sechsstelligen Kopplungscode eingeben. PC und Headset müssen sich erreichen können; eine lokale Firewall kann den angezeigten Port blockieren.
4. Die Vorschauseite zeigt den Aufbau und folgt Änderungen sofort. Für immersives VR dort **VR starten** wählen. Ohne VR lässt sich dieselbe Übertragung in einem zweiten Browser testen.
5. **Übertragung beenden** schließt die Empfangssitzungen. Für einen neuen Start entsteht ein neuer Kopplungscode.

Es ist keine erneute Gerätekonfiguration oder Anmeldung in der Brille nötig. Der Zahlencode koppelt genau diese Vorschau; intern erhält die Brille eine zufällige Sitzungskennung und eine separate Berechtigung für begrenzte Musikbefehle. Musik bleibt auf dem Rechner; es werden keine Audiodateien an die Brille geschickt.

## Netzwerk und HTTPS

Der Backend-Prozess öffnet nach dem Klick einen eigenen Vorschau-Listener auf dem festen LAN-Port **3031** (mit `VR_PREVIEW_PORT` konfigurierbar). Dadurch funktioniert die Übertragung auch bei einer Haupt-App auf localhost, einschließlich der Desktop-App. Der Listener liefert ausschließlich die Vorschauseite, ihre Renderer-Module und den Ereignisstrom aus. Zusätzlich ist ausschließlich der begrenzte VR-Befehlskanal erreichbar; sonstige Steuer- und Bearbeitungs-APIs sind dort gesperrt.

Mit HTTP funktioniert die Live-Vorschau, aber kein immersives WebXR. Der Benutzer erhält diesen Hinweis direkt beim Link. Für VR muss der Vorschau-Listener HTTPS mit einem Zertifikat verwenden, das zur Heimnetz-Adresse passt und dem das Headset vertraut.

- CLI: die bestehenden Optionen `--https` sowie `SSL_CERT_FILE`/`SSL_KEY_FILE` verwenden; der Vorschau-Listener übernimmt TLS.
- Desktop-App: `SSL_CERT_FILE` und `SSL_KEY_FILE` gemeinsam setzen. Diese aktivieren HTTPS nur für die Vorschau; die lokale App behält ihren bisherigen Ursprung und ihre gespeicherten Daten.

Es wurden keine Zertifikate installiert, Firewall-Regeln geändert, öffentlichen Tunnel geöffnet oder externen Dienste veröffentlicht. Einfaches Zertifikats-/Internet-Pairing ist weiterhin ein separater Ausbau.

## Daten und Lebenszyklus

Der Sender übermittelt vollständige Szenenschnappschüsse mit Raum, Lichtfläche, Gerätestandorten, Lichtzielen/Farben/Helligkeit, Ruhezonen, optionalen Gästen und dem Startpunkt. Positionen der Gerätegruppen sind dadurch bereits enthalten. Analyse und Musikwiedergabe bleiben auf dem Rechner; Kopfbewegungen verarbeitet der Headset-Renderer lokal.

Bei verbundenem Empfänger werden bis zu 20 Schnappschüsse pro Sekunde gesendet; ohne Empfänger etwa zwei. Es gibt höchstens eine laufende Upload-Anfrage. Lichtziele, Helligkeit und Gästeanimation werden mit einem 120-ms-Wiedergabepuffer interpoliert, um unregelmäßige Paketabstände zu überbrücken. Kopftracking und Steuerbefehle bleiben unmittelbar. SSE stellt bei Wiederverbindung den neuesten vollständigen Stand zu, statt alte Bewegungen abzuarbeiten. Bei länger als drei Sekunden ausbleibenden Daten zeigt die Seite den Verbindungsverlust und dunkelt die veralteten Lichtzustände ab. Ein Serverneustart oder Ablauf erfordert einen neuen Link; kurze Netzunterbrechungen überbrückt die Seite automatisch.

Sitzungen sind nur im Speicher, auf vier Sender und jeweils vier Empfänger begrenzt, mit maximal 1 MiB pro Schnappschuss. Nach zwei Minuten ohne Senderdaten laufen sie ab. Schreibzugriff benötigt zusätzlich zum bestehenden App-Zugang eine eigene Senderkennung; der Leselink gewährt diesen Zugriff nicht. Die beim Koppeln erhaltene Controller-Berechtigung erlaubt nur Deck-Auswahl, Play/Pause, Positionssprung und Tempo. Langsame Empfänger verursachen keinen unbegrenzten Rückstau. Bei Backend-Ende werden die Vorschau-Verbindungen geschlossen.

## Validierung

- `test/vr-preview.test.mjs`: vollständiger Erstzustand, Live-Änderung, Wiederverbindung, letzte Sequenz, Ende/ungültiger Link, Senderberechtigung, ungültige Geometrie, gesperrte Steuer-APIs am Vorschau-Port.
- `scripts/check-vr-preview.mjs`: zwei getrennte Browserseiten; Start in der echten 3D-Oberfläche, Live-Raumänderung 8 auf 14 m, Neuladen des Empfängers mit erneutem Zustand, Übertragung beenden. Der erweiterte Test prüft zusätzlich Deck-Wechsel, Play/Pause und einen Positionssprung mit einem echten geladenen WAV über den Rückkanal.
- Bestehende App-Tests: 26 bestanden.
- Ein echtes Headset und ein im Headset vertrauenswürdiges TLS-Zertifikat standen für den Test nicht zur Verfügung.

Die reine Vorschau-Adresse `/` sowie `/vr-view/` öffnen ebenfalls die Empfangsseite. Kein langer Sitzungspfad muss übertragen werden. Zahlencodes sind sechs Stellen einschließlich möglicher führender Nullen, während der Sitzung eindeutig und werden beim Beenden ungültig. Kopplungsversuche sind auf zehn pro Minute und Netzwerkadresse begrenzt. Die Kopplung über Zahlencode wurde mit zwei Browseransichten einschließlich Live-Änderungen und erneutem Laden geprüft.

Der Vorschau-Port bleibt auch bei einem neuen Kopplungscode gleich. Wenn er bereits belegt ist, wird ein verständlicher Fehler angezeigt; es wird nicht stillschweigend ein anderer Port gewählt. Eine geänderte IP-Adresse des Rechners ist davon unabhängig.

## Bedienung in VR

Das Pult über dem linken Controller zeigt Decks, Songtitel, Zeit und Fortschritt sowie Play/Pause, ±10 Sekunden und VR beenden. Rechts zeigen und den Trigger betätigen. Linker Stick: gehen; rechter Stick: 30° drehen. Ohne linken Controller erscheint das Pult vor dem Kopf.

Der Server reicht Musikbefehle an den sendenden Rechner weiter. Dieser führt sie über den bestehenden Transport aus und quittiert die Befehlskennung. Wiederholte Zustellung führt nicht zu erneutem Umschalten; nach drei Sekunden verfallen nicht abgeholte Befehle. Die Anzeige bestätigt Wiedergabe erst mit dem tatsächlich vom Rechner gemeldeten Zustand. Bei veralteten Szenendaten werden Musikaktionen deaktiviert, VR beenden bleibt nutzbar. Audio bleibt am Rechner. Gegebenenfalls muss die Audiowiedergabe dort einmal per Klick freigegeben werden.

Nach einem Update Backend und beide Browserseiten neu laden und mit dem Zahlencode neu koppeln, damit die Brille auch die Controller-Berechtigung erhält.

Aktuelle Prüfung des VR-Pults: 131 DMX-/VR-Tests bestanden; beide Browserchecks (`check-dmx-vr.mjs`, `check-vr-preview.mjs`) bestanden.

## Direkter Testzugang

`https://<Rechner-IP>:3031/vr-test` verbindet ohne Zahlencode mit der zuletzt gestarteten, noch aktiven Übertragung, einschließlich VR-Musiksteuerung. Der Link steht auch im Dialog unter **Testzugang ohne Code öffnen**. Zuerst am Rechner die Übertragung starten; falls noch keine läuft, wartet die Seite und versucht es automatisch erneut. Beim Beenden einer Übertragung verbindet sich derselbe Pfad erneut, sobald eine aktive Sitzung verfügbar ist. Sitzungskennungen werden nicht in die URL geschrieben.

Dieser ausdrücklich freigegebene Testzugang benötigt keine Kopplungsberechtigung: Wer den Vorschau-Port erreicht, kann die Show sehen und die begrenzte Deck-Steuerung bedienen. Andere Bearbeitungs-APIs bleiben gesperrt. Backend und Browserseiten nach dem Update neu starten/laden. HTTPS-Vertrauen bleibt Voraussetzung für immersives VR.
