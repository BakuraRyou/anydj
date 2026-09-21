# TIDAL in AnyDj: Integration mit vorhandenen Decks

Stand: 21.09.2026. Recherche und Prüfung unserer Architektur; keine TIDAL-App-
Berechtigungen, Partnerunterlagen oder Live-Wiedergabetests vorhanden.

## Ergebnis

Empfohlen ist eine offiziell freigegebene DJ-Integration mit einem Adapter für
unsere bestehenden Decks. Ein allgemeiner Entwicklerzugang allein belegt die
dafür nötigen Fähigkeiten nicht. Eine eigene Client-ID ist für den Test nötig,
aber kein Nachweis einer DJ-Freigabe. Zugang, Vertragsumfang und tatsächliche
Wiedergabefähigkeiten müssen getrennt geprüft werden.

TIDAL bietet DJ-Wiedergabe sowie je nach Partner Stem-Separation und Offline-Modus
an. Dafür ist auf Nutzerseite TIDAL DJ erforderlich. Daraus folgt nicht, dass jede
neue App diese Funktionen erhält. [Offizieller DJ-Support](https://support.tidal.com/hc/en-us/articles/27563493690129-Tidal-DJ).

Die veröffentlichten Designvorgaben beschränken Wiedergabe außerhalb von Embeds
auf Vorschauen. Das ist keine geeignete Grundlage für vollständige DJ-Decks.
Eine gesonderte Freigabe kann andere Möglichkeiten eröffnen; deren Umfang ist
für AnyDj noch unbekannt. [Designvorgaben](https://developer.tidal.com/documentation/guidelines/guidelines-design-guidelines).

Die allgemeinen Guidelines verlangen ausdrückliche schriftliche Zustimmung für
KI-Nutzung, Integration mit anderen Streamingdiensten und audiovisuelle
Synchronisation. Für AnyDj müssen daher gemischte Provider-Warteschlangen,
KI-Inferenz und musikgesteuertes Licht ausdrücklich beschrieben werden. Ob die
Lampensteuerung unter die Synchronisationsklausel fällt, ist mit TIDAL zu klären;
eine DJ-Freigabe allein ist kein belegter Ersatz. [Guidelines](https://developer.tidal.com/documentation/guidelines/guidelines-developer-guidelines).

## Technischer Befund

- Der Web-SDK exportiert `getMediaElement()`. Ein Anschluss an Web Audio ist
  deshalb technisch untersuchenswert. Die Methode garantiert aber weder
  auswertbare PCM-Daten unter DRM/CORS noch die Erlaubnis zur Analyse.
  [Öffentliche SDK-Exports](https://github.com/tidal-music/tidal-sdk-web/blob/main/packages/player/src/index.ts).
- Der Player hat globalen Zustand mit `activePlayer` und `preloadPlayer`.
  Das belegt Vorladen, keine zwei unabhängig bedienbaren DJ-Decks. Zwei interne
  Mediaelemente sind ebenfalls kein Nachweis paralleler DJ-Wiedergabe.
  [Player-Zustand](https://github.com/tidal-music/tidal-sdk-web/blob/main/packages/player/src/player/state.ts).
- Die öffentliche API bietet Laden, Play/Pause, Seek, Lautstärke und Folgetitel.
  Eine unabhängige Mehrdeck-API mit Tempo/Pitch ist in den geprüften Exports nicht
  dokumentiert. [Player-API](https://github.com/tidal-music/tidal-sdk-web/blob/main/packages/player/src/api/index.ts).
- Der im SDK-Quelltext vorhandene Web-Audio-/Analyser-Block ist auskommentiert.
  Er ist kein nutzbarer, zugesicherter Analysezugang.
  [Audio-Kontext-Modul](https://github.com/tidal-music/tidal-sdk-web/blob/main/packages/player/src/player/audio-context-store.ts).

## Anschluss an unsere Anwendung

`public/dj-performance.js` verbindet derzeit je ein lokales Audioelement mit EQ,
Pegelanzeige, Crossfader, Master und Kopfhörerbus. `public/dj.js` dekodiert für die
Vorabanalyse die vollständige Datei. `public/provider-queue.js` kennt lokale
Dateien und Spotify explizit. Ein TIDAL-Stream kann diese Datei-Abhängigkeit nicht
einfach durch eine Track-ID ersetzen.

Vorgeschlagene Umsetzung nach bestätigtem Zugang:

1. Gemeinsame Track-Referenz mit Provider, ID, Metadaten und optionaler lokaler
   Zuordnung. Queue-Einträge verweisen darauf und enthalten keine Stream-URLs.
2. Einheitliche Deck-Schnittstelle: `load`, `play`, `pause`, `seek`, `setVolume`,
   `unload`, Zeit-/Statusereignisse. Fähigkeiten wie parallele Wiedergabe,
   Tempo, Vorhören und Analyse werden intern explizit erfasst.
3. Lokale Wiedergabe nutzt weiter unsere Audioverarbeitung. Der TIDAL-Adapter
   verwendet den freigegebenen Player. Ist ein eigener Audiobus zulässig und
   verfügbar, Anschluss an unsere bestehende Mischerkette; andernfalls Abbildung
   auf die vom Partner-SDK unterstützten Mischfunktionen. Keine zweite ungewollte
   Audioausgabe und kein zweites Wrapping desselben Mediaelements.
4. Analyse separat: Live-Pegel/Beat-Erkennung aus freigegebenem Audiosignal;
   vollständige Wellenform und Songstruktur nur mit zugelassenem Vorabzugriff oder
   geeigneten bereitgestellten Analysedaten. Live-Analyse kennt den zukünftigen
   Songverlauf nicht. KI-Inferenz bedarf eigener Freigabe.
5. TIDAL-Tab, Cover, Playlists, Suche, Drag-and-drop und Queue an dieselben
   Oberflächen anschließen. Vorhandene lokale Zuordnungen als Alternative nutzen,
   ohne einen Stream als lokale Datei darzustellen.

Browser zunächst bevorzugen. Falls ein DJ-SDK nur nativ verfügbar ist, unsere
vorhandene Desktop-Ausgabe auf Eignung prüfen. Electron allein erweitert weder
Providerrechte noch Streamzugriff; eine native Brücke wäre ein eigenes Vorhaben.
Kein Speichern von Musikdateien auf dem Plesk-Server erforderlich oder vorgesehen.

## Abnahmetest vor vollständigem UI-Einbau

Mit eigener App-ID und freigegebenem Testkonto prüfen:

1. Vollständiger Titel statt Preview, lokal über HTTPS und auf anydj.de.
2. Zwei unterschiedliche TIDAL-Titel gleichzeitig; unabhängiges Seek, Pause,
   Lautstärke und Vorhören. Kein Entzug der Streaming-Sitzung des ersten Decks.
3. Crossfades TIDAL → TIDAL und lokal → TIDAL → lokal ohne Aussetzer.
4. Dokumentierter Audio-/DSP-Zugang liefert verwertbare Pegel und Frequenzdaten;
   separate Bestätigung für KI-Inferenz, Analysecache und Lichtsteuerung.
5. Verhalten bei Tokenablauf, Netzverlust, nicht verfügbarem Titel und beendetem
   DJ-Abo. Ein Fehler darf den funktionierenden lokalen Player nicht stoppen.

Ohne diese Ergebnisse keine Zusage „wie lokale Dateien“. Login oder eine
abspielbare Vorschau reicht als Integrationstest nicht aus.

## Anfrageentwurf an TIDAL — nicht versendet

Kontaktweg: [offizielle Developer Discussions](https://github.com/orgs/tidal-music/discussions)
für die zuständige DJ-Partnerstelle; alternativ [offizieller Support](https://tidal.com/contact/).
Ein frei zugänglicher, verbindlicher DJ-SDK-Onboardingprozess wurde nicht gefunden.

> We are developing AnyDj, a browser and Electron DJ application with two decks,
> local audio mixing and music-driven lighting. We would like to apply for an
> official TIDAL DJ integration. Which partner program, SDK and app entitlements
> support full-track playback, two independently controlled decks, crossfading
> between TIDAL tracks and user-owned local files, headphone cueing and tempo/key
> control? Is this supported in browsers or only through a native SDK?
>
> Please clarify permitted access to decoded audio or supplied analysis data for
> waveforms, beat/phrase detection, local ML inference (not model training), and
> synchronized lighting. We also need clarification on queues containing other
> streaming providers, metadata/analysis-cache retention and commercial use.
> We do not intend to export tracks or host music files on our server. Which
> written approvals and technical acceptance tests are required?
