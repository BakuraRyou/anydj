# Farbplanung für AnyDj: untersuchter Ansatz

Status: Prototyp implementiert; Songanalyse verwendet die neue Farblogik.
Der bisherige Verlauf ist im Farbmenü als Vergleich wählbar.
Ziel: überzeugende Farben bei unbekannten Songs, ohne Songpaare, ohne Änderungen
an den bereits bewährten Beat-, Bewegungs- und Helligkeitskurven.

## Befund im aktuellen Code

- `song-palette.js` verdichtet den Song und seine Abschnitte auf Mittelwerte
  von vier Merkmalen. Instrumentenverläufe und musikalische Phrasen gehen nicht
  direkt in diese Berechnung ein. Unterschiedliche Verläufe mit gleichen
  Mittelwerten können deshalb dieselbe Palette erhalten.
- Textur reduziert dort die Sättigung. `show-plan.js` verändert sie zusätzlich;
  der Gesamteindruck kann dadurch matter werden.
- `color-choreography.js` alterniert überwiegend zwischen Grundfarbe und
  entferntester Palettenfarbe. Das begrenzt den wahrnehmbaren Farbumfang.
- Full, Lichtbühne und Cover-Ersatz sollten weiterhin dieselbe Quelle verwenden.

## Forschungsgrundlage und Grenzen

[Palmer et al., PNAS 2013](https://doi.org/10.1073/pnas.1212562110)
finden in Versuchen mit 18 klassischen Musikausschnitten Zusammenhänge zwischen
emotionalen Assoziationen von Musik und gewählten Farben, mit Teilnehmenden in
USA und Mexiko. Das belegt keine eindeutige Farbzuordnung für beliebige
DJ-Musik und keine optimale Live-Lichtshow.

[Lindborg & Friberg, PLOS ONE 2015](https://doi.org/10.1371/journal.pone.0144013)
untersuchen 27 Filmmusikausschnitte mit 22 Teilnehmenden und unterstützen ebenfalls
eine Vermittlung über wahrgenommene Emotionen. Auch diese begrenzte Studie ist
kein Produktionsrezept für Bühnenbeleuchtung.

[SeqLight, Preprint 2026](https://arxiv.org/abs/2605.03660)
untersucht gelernte Farbverteilungen und ihre Verteilung auf mehrere Lichter.
Interessanter Vergleichskandidat; für AnyDj wurden weder Modellqualität,
Laufzeit, Lizenz der Gewichte noch Integration validiert. Kein belegter Ersatz
für unsere funktionierende Steuerung.

## Empfohlener nächster Prototyp (Designentscheidung)

1. Die vorhandene Stimmung und Strukturanalyse bilden den Kontext. Fehlende oder
   unsichere Aussagen bleiben unsicher; Energie oder Moll allein bedeuten nicht
   automatisch eine bestimmte Emotion.
2. Pro Phrase Merkmale und Veränderungen auswerten: neue Instrumentaktivität,
   spektrale Veränderung, harmonische Sicherheit, Rolle im Abschnitt und
   Wiederholung. Nicht ausschließlich Abschnittsmittel verwenden.
3. Für jede Phrase dominante Farbe, Begleitfarbe und sparsam eingesetzte
   Akzentfarbe planen. Diese Rollen werden zugewiesen, nicht ständig gleichzeitig
   angezeigt. Ruhige Passagen dürfen bei einer kräftigen Farbe bleiben.
4. Wiederkehrende Motive erhalten eine wiedererkennbare Farbidentität. Neues
   musikalisches Material darf einen klar anderen Farbbereich erhalten.
   Wiederholungen variieren nur bei nachgewiesener musikalischer Veränderung.
5. Farbwechsel an bestehenden musikalischen Ereignissen ausrichten. Haltezeiten
   und eine Mindeständerungsschwelle vermeiden Flackern durch Analyse-Rauschen.
   Übergänge dürfen weich oder bewusst direkt sein, je nach bestehender Phrase.
6. Farbton und Farbreinheit getrennt von der vorhandenen Helligkeitskurve
   behandeln. Textur darf nicht pauschal entsättigen. Wahrnehmungsorientierte
   Farbabstände und Übergänge einschließlich RGB-Gamut-Begrenzung evaluieren;
   RGB-Mittelwerte können unerwünschte Zwischenfarben erzeugen.
7. Eine vorberechnete Farbereignisfolge speist Decks, Full, Lichtbühne und
   Profil-Cover. Manuelle Farben haben Vorrang. Gleiche Analyse muss dieselbe
   Ausgabe liefern, unabhängig von Wiedergabereihenfolge oder Seeking.

## Vergleich vor Umstellung des Standards

- Alten und neuen Farblauf auf derselben Audioposition mit identischen
  Helligkeits-, Beat- und Bewegungskurven anbieten. Reihenfolge A/B wechseln.
- Entwicklungsbeispiele aus unterschiedlichen Musikrichtungen; separate,
  vorher nicht zur Abstimmung verwendete Tracks für den abschließenden Vergleich.
  Das sind Teststücke, keine programmierten Songpaare.
- Menschlich bewerten: Stimmung passend? Wechsel nachvollziehbar? Wiederholungen
  erkennbar? Genug Abwechslung ohne Unruhe? Kräftige oder ungewollt matte Farben?
- Technisch prüfen: unveränderte Dimmerwerte und Beat-Zeitpunkte, Blackouts,
  kontinuierliche Übergänge, deterministisches Seeking, manuelle Overrides,
  zwei Decks beim Crossfade und konsistente Darstellung aller Ausgaben.
- Den Bildschirmvergleich mit realen Lampen ergänzen. RGB-Ausgaben auf
  unterschiedlichen Geräten sind ohne Kalibrierung nicht identisch.
- Nicht nach maximaler Anzahl verschiedener Farben optimieren. Mehr Farben sind
  kein Nachweis für bessere musikalische Passung.

Die vorgeschlagene Architektur ist eine begründete Arbeitshypothese. Den besten
Ansatz für AnyDj bestimmt der Vergleich mit menschlichen Bewertungen, nicht
allein das Bestehen von Unit-Tests oder ein weiteres KI-Modell.

## Umsetzung und technische Prüfung

`public/color-direction.js` plant anhand der bestehenden Phrasen Grund-, Begleit-
und Akzentfarben. Ähnliche Motive werden anhand von Klangmerkmalen, Stimmung und
Motivzuordnung wiedererkannt. Instrumentdaten sind optional; ohne KI bleibt der
Planer mit den vorhandenen Browsermerkmalen funktionsfähig. Unsichere Stimmung
wird nicht als feste Emotion interpretiert. Haltezeiten und Änderungsschwellen
begrenzen unnötige Wechsel; deutliche Übergänge zur Feature-Rolle bekommen Kontrast.

Die neue Farbspur wird getrennt vom bisherigen Ergebnis gespeichert und erlaubt
den Wechsel ohne weitere Inferenz. Show-Version 19 verhindert die Verwechslung
mit alten Cache-Daten. Manuelle Track-Paletten sowie Abschnittsfarben und
reduzierte Farbbewegung bleiben wirksam. RGB wird aus OKLCH mit Chroma-Begrenzung
auf den RGB-Farbraum erzeugt und für den getrennten Dimmer normalisiert. Das ist
keine physikalische Lampenkalibrierung und garantiert keine identische wahrgenommene
Helligkeit unterschiedlicher Farbtöne.

Tests vergleichen die Dimmerwerte auch zwischen den Beats für alle Lichtprofile,
prüfen Motivwiederholung, Instrumentwechsel bei gleichem Spektrum, unsichere
Stimmung, Stille, RGB-Grenzen, Seeking und manuelle Overrides. Der Browsertest
wechselt beide Farbmodi ohne Änderung der Audioposition und prüft Full sowie
Cover-Fallback. Die älteren Wechseltests bleiben für den Vergleichsmodus erhalten.

Noch offen: menschliche Bewertung, ein verblindeter Vergleich mit wechselnder
A/B-Reihenfolge und der Test auf realer Licht-Hardware. Nicht live veröffentlicht.
