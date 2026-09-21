# TIDAL-Basisintegration

Stand: 21.09.2026. Keine Live-Zugangsdaten verwendet, kein Deployment ausgeführt.

Implementiert: dritter Provider-Tab, gemeinsame Tastaturnavigation, Verbindung
über PKCE-Popup, Client-ID-Konfiguration, Profil-Ländercode, gespeicherte Playlists,
Lieblingssongs, Titelsuche, Playlist-Link, Cover und Cursor-Nachladen. Playlist-
Klicks öffnen Inhalte in AnyDj; externe Titel-/Playlist-Links stehen unter Mehr.

Lokale Dateien werden ausdrücklich zugeordnet. Einreihen, mehrfach vorkommende
Titel, Sammel-Einreihen, Deck A/B und Drag-and-drop nutzen anschließend die lokalen
Dateien. Nicht zugeordnete Titel bieten keine vermeintliche Streaming-Wiedergabe.
Einzelheiten zur fehlenden DJ-/Streamingfreigabe stehen im TIDAL-Infodialog.

API-/OAuth-Abgleich mit den offiziellen Quellen:

- [API-Schemas](https://github.com/tidal-music/tidal-sdk-web/blob/main/packages/api/src/allAPI.generated.ts)
- [API-Basis-URL](https://github.com/tidal-music/tidal-sdk-web/blob/main/packages/api/src/api.ts)
- [OAuth/PKCE](https://github.com/tidal-music/tidal-sdk-web/blob/main/packages/auth/src/auth/auth.ts)

Tokens und lokale Zuordnungen liegen im Session Storage; Trennen entfernt sie und
die geladenen Ansichten. Späte Requests dürfen eine getrennte Sitzung nicht
wiederherstellen. Bearer-Tokens werden nur an openapi.tidal.com/v2 gesendet.
Keine Schreib-Scopes und kein Client Secret im Frontend. Zertifikate und
Deployment-Zugangsdaten wurden nicht angefasst.

Die Tests simulieren TIDAL-Antworten nach dem offiziellen Schema. App-Freigaben,
echte Playlists, Token-Endpunkt-CORS, Bilder-CDN und das Verhalten eines echten
TIDAL-Logins müssen mit eigener Client-ID und Konto separat abgenommen werden.

Prüfergebnis: 19 Unit-/Servertests bestanden (`tidal`, `spotify`,
`dj-module-loading`, `hosting`). Die Browserchecks `check-tidal`, `check-spotify`
und `check-dj-startup` bestanden ohne Browser-Ausnahmen. Hosting-Build erfolgreich.
