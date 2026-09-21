# Spotify-Wiedergabe und gemischte Warteschlangen

Stand: 21.09.2026. Implementiert, lokal geprüft; nicht live deployt.

- Playlist, Name und Cover öffnen die Playlist innerhalb von AnyDj. Externe
  Spotify-Links liegen in Untermenüs.
- Spotify-Titel lassen sich abspielen, einreihen und auf Deck A/B laden, auch
  per Drag-and-drop. Deck-Steuerung: Play/Pause, Position und Lautstärke.
- Gemeinsame Warteschlange und gespeicherte Listen erhalten lokale und Spotify-
  Einträge einschließlich Reihenfolge und Wiederholungen. Providerwechsel erfolgen
  am Titelende ohne Überblendung und ohne parallele lokale/Spotify-Wiedergabe.
- Öffentlicher Web Playback SDK mit Premium und zusätzlichen OAuth-Scopes;
  vorhandene Verbindungen müssen einmal neu autorisiert werden. Keine Audiodateien
  oder Bibliothekskopien auf dem Server. Provider-Metadaten bleiben im Browser.
- Spotify liefert keine PCM-Daten für vorhandene Analyse, Beat-Sync oder
  musikabhängige Live-Lichtberechnung. Diese Funktionen werden nicht simuliert.

Prüfung:

- `node --test test/spotify.test.mjs test/spotify-playback.test.mjs test/dj-module-loading.test.mjs test/hosting.test.mjs`: 19 bestanden.
- `node scripts/check-spotify-playback.mjs`: bestanden; lokale Datei → Spotify →
  lokale Datei, keine Audioüberlappung, gespeicherte gemischte Liste nach Reload,
  interne Playlist-Navigation, Untermenüs, Provider-Drag-and-drop, Desktop/Mobil.
- `node scripts/check-spotify.mjs`: bestanden; bestehende Bibliotheksfunktionen,
  Anmeldung, Pagination, lokale Zuordnung, Suche, Trennen und Unterordnerbetrieb.
- `node scripts/check-dj-startup.mjs`: bestanden; Dev-Module, zwei Decks, Reload,
  zentraler Spotify-Login, keine Browser-Ausnahmen.
- `node scripts/build-hosting.mjs`: erfolgreich.

Die Spotify-Browsertests verwenden simulierte API- und SDK-Antworten sowie echte
lokale Demo-Audiodateien. Premium-Berechtigung, DRM, Autoplay-Verhalten und echte
Spotify-Wiedergabe müssen mit dem angemeldeten Konto im Zielbrowser geprüft
werden. Der Reload-Test wartet ausdrücklich auf das neue Dokument; zuvor konnte
er vor abgeschlossener Navigation noch die alte Listenauswahl bedienen.
