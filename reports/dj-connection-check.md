# Automatische Verbindung beim Öffnen

- DJ-Seite startet die Verbindungsprüfung direkt, parallel zum Bibliotheksladen.
- Eigene sichtbare Statusanzeige; kein Play-Klick notwendig.
- Browserprüfung mit echtem Demo-HTTP-Server: offline beim Öffnen, Rückkehr unter
  neuer IP, automatische Erkennung, erneutes Laden, keine gestartete Musiksitzung
  und keine Browserfehler. Reproduzierbar mit `node scripts/check-dj-connection.mjs`.
- `npm test`: 175 Tests bestanden. Neue Transporttests prüfen explizite
  Byte-Länge, Header-Schreibweise, abgeschlossene Antworten, Antwortkörper-Timeout,
  fehlende automatische POST-Wiederholungen und fehlende Redirect-Verfolgung.
- Der direkte Setup-HTTP-Transport ersetzt Fetch für die kleine
  Einrichtungsschnittstelle. Physische Wirksamkeit noch nicht bestätigt.
- Beim aktuellen Praxistest war zunächst kein App-Server aktiv; Server gestartet.
  AnyDjConfig_d27c war in wiederholten Scans nicht sichtbar; UDP-Suche fand keine
  Lampe. Ein vollständiger echter Pairing-Nachweis benötigt die erreichbare Lampe.
