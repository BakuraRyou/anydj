# Gerätemanager: aktuelle Oberfläche und veralteter Code

## Verbindliche Zuordnung für UI-Arbeiten

Mit **Gerätemanager** ist ausschließlich die Raumplan-Oberfläche gemeint:
**Lichtshow → große 3D-Ansicht → Geräte → „Deinen Raum planen“**.

- Aktuelle Logik und Platzierungsplan: `public/dmx-ar-planner.js`.
- Kompakte Gerätebedienung: `public/dmx-device-manager.js` und `public/dmx-device-manager.css`.
- Einbettung: `public/dmx-stage-workspace.js`.
- Grundstile des Raumplaners: `public/dmx-ar.css`.

## VERALTET — nicht als UI auswählen

`public/dmx-layout.js` enthält den **alten Gerätemanager** mit
`#stageLayoutDialog`, `.stage-device-manager`, `data-layout-*` und
`data-position-device`. Seine UI ist veraltet. Verbleibende Daten- und
Vorschauadapter werden noch intern benötigt.

**Diesen alten Manager nicht überarbeiten, nicht wieder sichtbar machen und
keine neuen Zugänge zu seinem Dialog oder seiner eingebetteten UI anlegen.**
Seine Bezeichnung „Gerätemanager“ ist kein Hinweis auf eine aktuelle Oberfläche.
Arbeiten am Gerätemanager gehören in die oben genannten Raumplan-Dateien.
Vorhandene gespeicherte Bühnendaten nicht ohne Migration löschen.

Ältere Tests wie `scripts/check-dmx-layout.mjs` und
`scripts/check-device-manager-performance.mjs` prüfen den alten Manager.
Sie sind keine Abnahmekriterien für die aktuelle Geräteoberfläche.
