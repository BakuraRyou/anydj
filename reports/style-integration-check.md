# Stilverlauf und Hintergrundvorbereitung

20.09.2026. Planversion 9, Arrangementversion 3. Beat-This!-Modell, Decoder-Zeitbasis,
Beat-/Downbeat-Zeitpunkte und Licht-Sendeuhr unverändert.

Discogs-EffNet läuft über ONNX Runtime auf CPU, mit offizieller Essentia-MusiCNN-
Vorverarbeitung (16 kHz, 512 Samples, Hop 256, 96 Melbänder, 128 Frames pro Fenster).
Die 400 unabhängigen Modellwerte werden auf sieben überlappungsfähig verwendete
Lichtstil-Familien abgebildet. Zeitlich geglättete Mischgewichte beeinflussen sechs
Gestaltungsparameter. Ein einzelnes Genre-Etikett steuert nicht das ganze Lied.
Die ursprünglichen Top-5-Tags bleiben als Diagnose im Plan erhalten, werden aber
nicht als gesicherte Genrebezeichnungen angezeigt.

Zusätzlich beseitigt die Gestaltung zwei Bewegungsbremsen: schwächere Schläge
innerhalb eines akustisch belegten Grooves werden nicht mehr grundsätzlich
verworfen; Farbauslenkung addiert sich nicht mehr bis zu einem dauerhaft
festgeklemmten Endpunkt. Strophen und Refrains unterscheiden sich durch Kontrast
statt zwingend durch ausgelassene Schläge. Stille und konstante Flächen ohne
Anschläge erzeugen weiterhin keine aus dem Raster erfundenen Akzente.

Prüfung:
- 148 Node-Tests bestanden: Mischstile, weiche Übergänge, unsichere Klassifikation,
  unveränderte Beat-Zeitpunkte, manuelle Gestaltung, API-Validierung, Cache,
  Zugriffsschutz und Abbruch.
- Tatsächliche lokale Inferenz der vorhandenen MP3: 263,697 Sekunden Audio,
  129 Zeitfenster, 1,626 Sekunden einschließlich Python-Modellstart auf diesem
  Rechner. Das ist nur die Stilanalyse, nicht Beat-/Struktur-/Gesamtvorbereitung.
- Stummer Demo-Browser: Deck A lief während der Vorbereitung der vollständigen
  zweiten MP3 weiter, 2,55 Sekunden gemessener Wiedergabefortschritt,
  keine beobachteten Pausen, Deck B anschließend bereit. Der Hintergrundtest
  nutzte die eingebaute Beat-Analyse und das echte Stilmodell.
- Separater Player-Test mit echtem Beat This!: 544 Beat-Zeitpunkte, 129
  Stilfenster. Stilinformationen überleben Neuberechnung und die zusätzliche
  bereits vorhandene All-In-One-Struktur. Keine neue Strukturinferenz.
- Keine Browser-Ausnahmen und keine realen Lampen im Test angesteuert.

Grenzen: Ein realer Beispieltrack belegt keine zuverlässige Genreerkennung über
alle Musikrichtungen. Einzelne Subgenre-Tags waren wechselhaft (u. a. K-pop),
weshalb breite, gemischte und geglättete Einflüsse verwendet werden. Synthetische
Mischstiltests prüfen die Weiterverarbeitung, nicht die Erkennungsqualität für
einen realen Techno-/Klassik-Mix. Hör-/Sichtprüfung an realen Lampen steht aus.

Messdaten: `style-boddies.json`, `style-show-browser-check.json`,
`style-background-browser-check.json`. Modelldokumentation:
https://essentia.upf.edu/models.html#discogs-effnet
