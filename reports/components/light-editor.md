# Eigenständiger Lichteditor

`createLightEditor(host, options)` aus `public/light-editor.js` montiert eine
unabhängige Editorinstanz. Keine globalen IDs, kein Zugriff auf DJ-Decks,
Geräte oder Persistenz. Styles werden relativ zum Modul geladen.
`section-editor.js` ist der kleine Adapter für den bestehenden DJ-Dialog.

```js
import {createLightEditor} from './light-editor.js';
const editor = createLightEditor(container, {
  title: 'Mein Song',
  plan,                       // berechneter Plan mit frames, sections, arrangement
  edits: savedEdits,           // undefined: Analyse übernehmen; []: alles automatisch
  audioSrc: optionalAudioUrl,  // lokale Audiovorschau, keine Geräteausgabe
  position: () => 0,           // Abspielposition des aufrufenden Players
  onBeforePlay: async () => {}, // Ausgabe vor Wiedergabe vorbereiten
  onPreview: ({time, plan, playing}) => {}, // bearbeiteter Plan für weitere Vorschauen
  onSave: async edits => { await save(edits); },
  onClose: () => { editor.destroy(); }
});
editor.setPosition(12.5);       // Vorschau von außen synchronisieren
const draft = editor.getEdits(); // unabhängige Kopie
editor.destroy();              // DOM, Audio und Animationsschleife entfernen
```

Der Eigentümer einer Objekt-URL gibt sie nach `destroy()` wieder frei.
`onPreview` ist eine Benachrichtigung; darin nicht erneut `setPosition` aufrufen.
Der DJ-Adapter stellt Audio bereit, wenn die Datei bereits geladen ist.
Ohne Audioquelle funktionieren Zeitleiste und Lichtvorschau weiterhin.

Phasen dürfen freie Bereiche lassen: Dort gilt die ursprüngliche Show.
Verschieben hält die Dauer und stoppt an Nachbarn. Eine gemeinsame Grenze
verändert beide benachbarten Phasen. Beat-/Taktraster oder freie Zeiten sind
wählbar. Pfeiltasten nutzen das aktive Raster, frei 0,1 s bzw. 1 s mit Shift.
Eine Ziehaktion erzeugt einen Rückgängig-Schritt. Pointer-Abbruch verwirft sie.

Speichern erfolgt ausschließlich über den asynchronen Callback. Bei einem
Fehler bleibt der Entwurf geöffnet. Abbrechen verändert gespeicherte Daten
nicht. Automatische Entwurfssicherung, separate Helligkeits-/Überblendparameter
und mehrere Gerätespuren sind in dieser Version noch nicht enthalten.
Die eigenständige Komponente bietet einen previewHost zur Einbettung einer Set-Vorschau. Der DJ-Adapter bettet dort die vorhandene konfigurierte Bühne ein.

Prüfung: `node --test test/light-editor-model.test.mjs test/section-lighting.test.mjs`
und `node scripts/check-section-lighting.mjs` (Chrome erforderlich).

## Überarbeitete Bedienführung

Zwei klar getrennte Bereiche: Abschnitt in der Zeitleiste auswählen und dessen
Lichtwirkung im Inspector ändern. Auswahl setzt die Vorschau an den Beginn.
Die Abschnittsliste zeigt vollständige Namen auch bei kurzen Zeitblöcken.
Drei Vorlagen und kontextabhängige Farbfelder bilden den einfachen Einstieg;
Zeiten, Lichtimpulse, Gruppen und Strukturwerkzeuge sind einklappbar.
Eine gemeinsame Fußleiste enthält Rückgängig, Status und Speichern.
Auf schmalen Bildschirmen stehen die Bereiche untereinander.

## Live am Set

Der DJ-Adapter pausiert die DJ-Wiedergabe beim Öffnen und übernimmt mit einer
eigenen Audioquelle. Die vorhandene Bühne wird für die Dauer der Bearbeitung
in den Editor versetzt. Der Entwurf liefert dieselben Frames, Paletten und
Musikparameter wie die normale DJ-Ausgabe. Bereits aktivierte DMX-Ausgabe
folgt dem Entwurf; eine ausgewählte WiZ-Lampe startet beim Anhören über eine
eigene Sitzung. Pause hält den Abspielpunkt, auch Scrubbing aktualisiert das
Licht. Regler und Farbauswahl liefern Vorschauen bereits auf input-Ereignisse.
Beim Schließen werden Audio, Timer und WiZ-Sitzung beendet und die Bühne
zurückgegeben. Die DJ-Wiedergabe wird nicht automatisch fortgesetzt.

Die Geräteausgabe bleibt an vorhandene Geräteverbindungen gebunden. Die
Moving-Head-Darstellung bleibt die bestehende Simulation. Es wurde kein
neuer physischer Pan/Tilt-Ausgabetreiber ergänzt.
