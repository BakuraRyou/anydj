# Lichtshow auf der Startseite

Die Startseite spielt drei vorberechnete Shows auf einer gemeinsamen 3D-Bühne ab. Jede Show enthält vier Moving Heads und vier feste Scheinwerfer. Audio ist eine separate Datei. Im Browser laufen weder Musikanalyse noch Geräteausgabe.

## Dateien und künftiges Admin-Backend

- `web/demo-shows/catalog.json`: die drei auswählbaren Plätze, Titel und Beschreibungen.
- `web/demo-shows/<name>.json`: Aufbau und vorberechnete Lichtzustände.
- `web/demo-shows/<name>.wav` (auch MP3, OGG oder M4A): zugehörige Musik.
- `public/landing-show-data.js`: gemeinsame Validierung und zeitliche Interpolation.

Ein Admin-Backend ist noch nicht vorhanden. Es muss später diese regulären JSON-Dateien und Audio unter `demo-shows/` veröffentlichen. Der Player braucht dafür keine Backend-spezifische API. Das Backend sollte die exportierten Funktionen `validateCatalog` und `validateShow` vor dem Veröffentlichen verwenden, Datei-/Audio-Limits prüfen und erst nach erfolgreichem Upload aller Dateien den Katalog ersetzen. Neue, eindeutige Dateinamen pro Veröffentlichung verhindern gemischte Versionen. Anmeldung und Upload-Berechtigung gehören ins künftige Backend.

Alle Pfade beginnen mit `./demo-shows/` und sind relativ zur Startseite, auch der Audiopfad innerhalb der Show. Externe URLs, `..`, Query-Parameter und aktive Inhalte werden nicht akzeptiert. Gleiche Herkunft vermeidet zusätzliche CORS- und CSP-Konfiguration. Unterpfad-Deployments sind möglich.

### Katalog

```json
{
  "version": 1,
  "shows": [
    {
      "id": "neon",
      "title": "Neon Pulse",
      "artist": "AnyDj · 120 BPM",
      "description": "Weite Bewegungen. Klare Beats.",
      "show": "./demo-shows/neon.json"
    },
    {
      "id": "sunset",
      "title": "Golden Hour",
      "artist": "AnyDj · 100 BPM",
      "description": "Warme Farben. Ruhiger Groove.",
      "show": "./demo-shows/sunset.json"
    },
    {
      "id": "electric",
      "title": "Electric Blue",
      "artist": "AnyDj · 132 BPM",
      "description": "Kühle Strahlen. Dynamische Fächer.",
      "show": "./demo-shows/electric.json"
    }
  ]
}
```

Es müssen genau drei Einträge mit eindeutigen IDs vorhanden sein. IDs enthalten 1–40 Kleinbuchstaben, Ziffern oder Bindestriche; Texte maximal 120 Zeichen. Katalog: maximal 16.000 Bytes.

### Show-Version 1

Eine vollständige Referenz ist `web/demo-shows/neon.json`.

| Feld | Inhalt |
| --- | --- |
| `version` | `1` |
| `duration` | Audio-/Showdauer in Sekunden, 1–300 |
| `audio` | Relativer Pfad unter `./demo-shows/` |
| `layout` | `width`, `depth` (4–20 m), `height` (2–8 m) |
| `fixtures` | Acht Geräte, in stabiler Reihenfolge |
| `frames` | Aufsteigende Zeitpunkte mit jeweils acht Lichtzuständen |

Ein Gerät sieht so aus:

```json
{"id":"head-1","type":"moving","beamAngle":9,"position":{"x":-3,"y":6.5,"height":3.2}}
```

Vier Geräte haben `type: "moving"`, vier `type: "par"`. `beamAngle` liegt zwischen 3 und 60 Grad. X läuft von `-width/2` bis `width/2`, Y von 0 bis `depth`; Höhe mindestens 0,1 m und höchstens Raumhöhe. Ziele liegen auf dem Boden. Feste Scheinwerfer behalten für eine Show dasselbe Ziel.

Jeder Frame hat die Form `{"time": 0, "lights": [...]}`. `lights` enthält in Geräte-Reihenfolge acht Arrays:

```json
[70, 240, 195, 0.8, -2.5, 3.2]
```

Die sechs Werte sind **Rot, Grün, Blau (0–255), Helligkeit (0–1), Ziel-X und Ziel-Y (Meter)**. Alle Werte werden zwischen den Zeitpunkten linear interpoliert. Der erste Frame muss bei 0 liegen, der letzte exakt bei `duration`. Maximal 18.001 Frames und 4 MiB pro Show. Die mitgelieferten Shows haben 20 Zeitpunkte pro Sekunde. Engere Zeitpunkte können kurze Akzente abbilden.

Das Format beschreibt bereits berechnete sichtbare Lichtzustände, keine Rohdaten der Musikanalyse und keinen DMX-Kanalexport. Ein späterer Export aus AnyDj muss dessen Lichtzustände auf diese acht Geräte abbilden.

## Wiedergabe und Performance

Die Audioposition ist die einzige Show-Uhr; Pause, Springen und Wiederholen benötigen keine erneute Analyse. Audiolänge und Showdauer dürfen um höchstens 0,3 Sekunden abweichen. Audio-Dateien dürfen beim Build maximal 25 MiB groß sein; Decoderunterstützung hängt vom Browser ab.

- Nachladen, sobald die Bühne sichtbar wird; nur ausgewählte Show und deren Audio.
- Maximal 30 Renderbilder/s; begrenzte Pixeldichte und Renderbreite.
- Bei langsamen Renderbildern sinkt die Auflösung automatisch bis auf 45 % der Ausgangsauflösung.
- Kein Renderloop während Pause; Neuzeichnen nur für Kamera, Größe oder Zeitleiste.
- Pausieren außerhalb der sichtbaren Bühne oder bei verborgenem Tab; Fortsetzen per Play.
- WebGL mit Canvas-Ausweichlösung; statisches 3D-Poster während des Ladens und bei Fehlern.
- Bei `prefers-reduced-motion` bleibt die Lichtansicht während der Musikwiedergabe still.

Die Browserprüfung verwendet SwiftShader (Softwaregrafik). Ihre Bildrate ist kein Nachweis für reale Mobilgeräte. Vor Veröffentlichung auf einem Android-Gerät und iPhone prüfen.

## Entwickeln und prüfen

```sh
node scripts/validate-landing-shows.mjs
npm run build:web
npm run preview:web
node --test test/landing-show.test.mjs test/hosting.test.mjs
node scripts/check-landing-show.mjs
```

Der Web-Build validiert alle drei Shows und vorhandenes Audio vor dem Erstellen von `dist/web`. Der Hosting-Server unterstützt Audio-MIME-Typen und Byte-Range-Anfragen. Statisches Hosting kann die Dateien ebenfalls direkt ausliefern.

Die drei mitgelieferten kurzen Tracks sind synthetische AnyDj-Demos. `node scripts/build-landing-demos.mjs` erzeugt sie und die dazu passenden Shows reproduzierbar neu und überschreibt die drei Beispielshows samt Katalog. Dies ist kein automatischer Build-Schritt und lässt eigene Shows beim normalen Build bestehen.

`node scripts/check-landing-show.mjs --update-poster` erstellt aus der ersten gebauten Demo ein neues `web/landing-show-poster.webp`. Danach erneut bauen, damit das Poster im Web-Paket landet. Browser-Screenshots und Prüfergebnis liegen unter `reports/landing-show/`.
