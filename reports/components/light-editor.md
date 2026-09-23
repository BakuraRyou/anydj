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
  onPreview: ({time, plan}) => {}, // bearbeiteter Plan für weitere Vorschauen
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
Die Vorschau zeigt Farbe und Helligkeit, keine vollständige Bühnensimulation.

Prüfung: `node --test test/light-editor-model.test.mjs test/section-lighting.test.mjs`
und `node scripts/check-section-lighting.mjs` (Chrome erforderlich).
