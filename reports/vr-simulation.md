# VR am Rechner simulieren

Im laufenden AnyDj-Deck die 3D-Ansicht öffnen und unter **VR-Vorschau verbinden → Übertragung starten** die Live-Vorschau aktivieren. Dieses Fenster geöffnet lassen: Es liefert den aktuellen Aufbau und steuert die Musik.

Im Projektordner:

```sh
npm run vr:sim
```

Der Befehl öffnet `http://127.0.0.1:3032/vr-test` in Chrome (Linux/macOS) beziehungsweise Edge (Windows). IWER simuliert eine Quest 3; die offizielle DevUI liefert Kopf- und Controllersteuerung. Die VR-Sitzung startet automatisch, sobald die aktuelle Show empfangen wurde. Ohne aktive Übertragung wartet die Seite. Nach einer neuen Übertragung verbindet sie sich automatisch erneut mit der zuletzt gestarteten Sitzung.

Die Darstellung verwendet für die Bildschirmbedienung eine einzelne Augenansicht. Musik bleibt im ursprünglichen AnyDj-Fenster; Befehle des virtuellen VR-Pults wirken auf dessen Deck. Der Simulator lädt keine separate Deck-Kopie und benötigt keine Browser-Erweiterung. Er startet ausschließlich den lokalen Simulator, nicht eine zusätzliche AnyDj-Instanz.

Mit **Strg+C** im Terminal den Simulator beenden. Die AnyDj-Übertragung bei Bedarf im Deck separat beenden.

## Optionen

- `VR_SIM_SOURCE`: Adresse der Vorschau, standardmäßig `http://127.0.0.1:3031`. Alternativ kann die HTTP(S)-Adresse der laufenden Haupt-App verwendet werden, wenn dort dieselbe Übertragung aktiv ist. Bei HTTPS muss Node dem Zertifikat vertrauen; eine lokale CA kann über `NODE_EXTRA_CA_CERTS` angegeben werden.
- `VR_SIM_PORT`: lokaler Simulator-Port, standardmäßig `3032`.
- `VR_SIM_BROWSER`: Browser-Programm oder vollständiger Programmpfad, beispielsweise `chromium`.
- `npm run vr:sim -- --no-open`: nur den Simulator starten, Browser manuell öffnen.

Beispiel mit abweichender Quelle unter Linux/macOS:

```sh
VR_SIM_SOURCE=http://127.0.0.1:3030 npm run vr:sim
```

Der Simulator bindet ausschließlich an `127.0.0.1` und reicht nur die Verbindung zur Testvorschau, den Szenenstrom und den vorhandenen Vorschau-Befehlskanal weiter. Die normale App und der Headset-Zugang laden IWER nicht. `iwer` und `@iwer/devui` müssen installiert sein (`npm install` einschließlich Entwicklungsabhängigkeiten).

## Prüfung

```sh
node scripts/check-vr-sim.mjs
```

Der Chrome-Browsercheck verwendet einen isolierten Demo-Server mit geladenem Testsong. Er prüft echten IWER-Sitzungsstart, die DevUI-Zeichenfläche, Live-Raumänderungen, den Musik-Rückkanal, erneutes Verbinden und die Begrenzung der Simulator-Routen. Er verwendet Port 3039. Headset-Komfort und die Leistung auf echter Hardware werden dadurch nicht geprüft.
