# Netcup / Plesk Deployment

## Ergänzung: Public-Auslieferung und Release-Bereinigung

- 17 Python-Tests erfolgreich: einschließlich Public-Aktivierung, Rollback,
  Wiederherstellung bei Übertragungs-/Manifestfehlern, Erhalt eigener Hosting-Dateien
  und Begrenzung auf drei Releases mit Schutz des aktiven und vorherigen Releases.
- 4 Node-Healthcheck-Tests erfolgreich: keine Bereinigung bei fehlgeschlagenem
  Healthcheck oder abweichendem Release.
- `node scripts/deploy.mjs --dry-run` erfolgreich; das Paket enthält die Webdateien
  sowohl direkt in `public/` als auch als Snapshot im Release.
- Diese Ergänzung wurde lokal geprüft und noch nicht auf den Server übertragen.
  Die tatsächlichen FTP-Verzeichniswechsel und die Live-Auslieferung bleiben beim
  nächsten Deployment zu prüfen. Ein fehlgeschlagener Healthcheck verhindert die
  automatische Bereinigung.

## Frühere Prüfung vor der ersten Übertragung

- Hosting-Build und `npm run deploy -- --dry-run`: erfolgreich.
- 3 Node-Tests: öffentliche HTTP-Auslieferung, Pfad-/Dateigrenzen, globaler
  Crash-Restart ohne Endlosschleife, CommonJS-Plesk-Bootstrap mit ESM-Release.
- 7 Python-Tests: vollständiger Upload vor Aktivierung, Upload-Abbruch,
  Rollback, Crash-Marker, Deploy-Sperre, Ausschluss versteckter Dateien/Symlinks,
  sichere Zielpfade.
- Echter FTPS-Test: Anmeldung, Verzeichniszugriff und geschützter Datenkanal
  erfolgreich; ausschließlich lesend. Ziel `/anydj.de` beim letzten Test vorhanden.
- TLS bleibt aktiviert. Die konfigurierte IP ist unverändert; Zertifikat und SNI
  werden mit `tlsServername` gegen `a2e2e.netcup.net` geprüft. Keine Abschaltung
  der Zertifikatsprüfung, keine Zugangsdaten in Ausgaben oder Prozessargumenten.
- `.env` ist ignoriert und liegt außerhalb des Hosting-Pakets.

Es wurde nichts hochgeladen, keine Remote-Datei verändert und kein entfernter
Prozess neu gestartet. Der echte Passenger-Lebenszyklus und die Domain-/Plesk-
Konfiguration sind daher noch nicht live geprüft. Für die Erstübertragung:
`npm run deploy -- --skip-health`; anschließend Einstellungen aus
`builder/README.md` übernehmen und `npm run deploy:restart` ausführen.
