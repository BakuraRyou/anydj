# DMX-Verbindung ohne Hardware geprüft

Stand: 20.09.2026.

Implementiert: OLA-HTTP-Transport auf Loopback-Port 9090, automatische Port-
Erkennung, Auswahl USB/lokal oder LAN, expliziter Start/Stop, vollständige
512-Kanal-Frames, exklusives Universum, Browser-Watchdog, Abschaltversuch beim
Trennen und Beenden. Dieselbe Showberechnung wie die virtuelle Bühne.

Prüfung:
- Vollständige Testsuite: 247 erfolgreich.
- Acht DMX-Tests: Kanalvalidierung, Hotplug, Reconnect ohne automatischen Start,
  Watchdog/Schwarzbild, Sitzungsrechte, Demo-Sperre, paralleler Start,
  OLA-Formularprotokoll, Übertragungsfehler und geschützte HTTP-Endpunkte.
- Browser mit simuliertem Interface: Erkennung, Einschalten, visuelle Demo
  ohne physische Farbausgabe, Trennen/Wiederverbinden, Abschalten bei geänderter
  Ausstattung; keine JavaScript-Ausnahmen.
- Bestehender Browser-Test der gemischten Bühne erfolgreich, einschließlich
  Gerätezahlen, Segmentänderungen, gespeicherter Einstellungen und Mobilansicht.
- Statische Web-Version erfolgreich gebaut; dort keine Hardware-Anbindung.
- Diff-Prüfung ohne Formatfehler.

Grenzen: Kein physisches Interface und kein echter OLA-Daemon getestet.
Der Transporttest simuliert die offizielle JSON-/Formularschnittstelle;
Browser-Tests verwenden einen Transport-Doppelgänger. Es gibt keine Messung
von USB-Timing, LAN-Empfang oder physischem Abschalten. Ein fehlendes Kabel
kann die Zustellung eines Schwarzbilds verhindern.

OLA ist eine separat einzurichtende Voraussetzung, kein mitgelieferter
Universaltreiber. Ein Interface/Universum kann mehrere kompatible Lampen
bedienen. Herstellerprofile, RDM-Erkennung und mehrere gleichzeitig aktive
Ausgänge sind nicht implementiert. Anleitung: [SETUP.md](../SETUP.md#dmx-über-usb-und-lan).

Protokollgrundlagen: [OLA JSON API](https://wiki.openlighting.org/index.php/OLA_JSON_API)
und [OLA HTTP-Implementierung](https://github.com/OpenLightingProject/ola/blob/master/olad/OladHTTPServer.cpp).
