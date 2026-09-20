# Fortlaufende DJ-Warteschlange

20.09.2026. Drei Einträge (einschließlich eines wiederholten Tracks) wurden im
stummen Demo-Browser auf A → B → A abgespielt. Zwei automatische Übergänge,
Nachladen, natürliches Listenende, Umordnen, Entfernen und Speicherung bestanden.
Nach Neuladen startet keine Wiedergabe automatisch. Desktop 1280×720 und
1024×768 ohne Seitenscrollen, Mobilansicht 390 px ohne horizontalen Überlauf.

Ein zusätzlicher Test hielt die Analyse des zweiten Tracks künstlich zurück:
Nach Ende des ersten Tracks blieb der Eintrag erhalten, die Automatik wartete
und startete anschließend das bereits vorbereitete Deck B. Automatik-Pause ließ
die Musik weiterlaufen. Ein fehlender Track stoppte die Automatik und blieb als
behebbarer Eintrag erhalten. Keine Browser-Ausnahmen, keine realen Lampen.

151 vorhandene Node-Tests bestanden. Browserprüfungen verwenden simulierte
Analyseantworten, echte Audioelemente und die produktive Queue-/Crossfade-Logik.
Die Stilerkennung im Hintergrund wurde separat im vorherigen Arbeitsschritt geprüft.

Reproduzierbarer Haupttest: `node scripts/check-dj-queue.mjs`.
Benötigt `/usr/bin/google-chrome`, ffmpeg und lokale Testserver; erzeugt seine
kurzen synthetischen Audiodateien temporär. Ergebnisse:
`dj-queue-browser-check.json`, Zusatzfälle: `dj-queue-edge-browser-check.json`.
