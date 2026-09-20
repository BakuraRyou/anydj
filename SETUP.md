# Experimentelle Einrichtung ohne WiZ-App

Stand: 19.09.2026. Nur `ESP03_SHRGB1C_01`, Firmware `1.32.0`.
Geräteidentifikation, WLAN-Zugangsdatenübertragung, Abschluss und anschließende
UDP-Abfragen (getPilot, getSystemConfig, getModelConfig) wurden an der echten
Lampe erfolgreich bestätigt. Die Lampe wurde in der App gespeichert. Ein
Stromausfall-/Neustarttest der Lampe wurde nicht durchgeführt.

1. Lampe in den manuellen Einrichtungsmodus bringen (WiZConfig_…-WLAN).
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
