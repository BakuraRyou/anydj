# Klangabhängige Varianten in Automatisch / Ausgewogen

Die bisherige rhythmische Planung legte für einen Abschnitt meist eine Formation fest und variierte darin wenige Posen. Die automatische Bewegungsplanung kann nun auf lokale Klangänderungen mit einer anderen Formation reagieren. Bestehende Lichtgruppen, Farben und statische Lichtquellen erhalten dadurch keine neue Schaltfolge.

## Auslöser

- Energieänderung gegenüber dem zuletzt übernommenen Klangbild ab 0,14.
- Änderung des perkussiven Anteils oder der Klangfarbe ab 0,18.
- Änderung des Gesangsanteils ab 0,20 oder Wechsel des erkannten führenden Instruments.
- Gemessene Melodieänderung ab 0,18 in der normierten Tonhöhenkontur.
- Bereits als herausragend ausgewählter Audioakzent ab 0,65 Salienz.

Die Auswertung findet an den vorhandenen musikalischen Bewegungsevents statt. Akzente behalten ihre tatsächlichen Zeiten; Änderungen kontinuierlicher Merkmale werden am nächsten verfügbaren Event aufgegriffen. Es gibt keinen Wechselzähler in Takten oder einen periodischen Formationswechsel. Eine Mindestzeit von 1,5 Sekunden zwischen akzeptierten Änderungen verhindert hektisches Neustarten; ihr Ablauf allein löst nichts aus.

Fächer, parallele, gekreuzte, flügelförmige und nach Höhe gestaffelte Posen werden nach ihrer Eignung für Energie, Percussion, Gesang und Klangfarbe bewertet. Zuletzt verwendete Formen erhalten einen kleinen Auswahlmalus, sobald ein musikalischer Auslöser vorliegt. Die Abfolge ist reproduzierbar und nicht zufällig. Versetzte Rollen bleiben möglich; bestehende Motorgrenzen und manuelle Bewegungspausen gelten weiter.

Der Eingriff betrifft den rhythmischen Pfad von `auto` mit Stimmung `balanced`. Ruhige, filmische und andere ausdrücklich gewählte Modi behalten ihren bisherigen Pfad. Bewegungsplan-Version: 35.

## Prüfung

23 gezielte Tests bestanden. Neue Fälle prüfen:

- Gleichbleibendes Audio rotiert auch über viele Takte nicht durch Formen.
- Unregelmäßige, herausragende Akzente lösen Änderungen an ihren tatsächlichen Zeiten aus. Verschiebt man die Akzente, verschieben sich die Reaktionen.
- Veränderte Instrumentenanteile können auch ohne herausragenden Schlag eine neue Form hervorrufen.
- Acht physische Moving Heads erhalten unterschiedliche Posen; Reload ist deterministisch, manuelle Haltephasen bleiben erhalten.

Gesamtsuite: 749 Tests, 746 bestanden. Weiterhin dieselben drei bekannten Fehler in `rhythm-recovery.test.mjs` und `stage-motion.test.mjs`.

Zusätzlicher Vergleich am vorhandenen gespeicherten Atomic-Damage-Analyseplan: unverändert 67 Bewegungscues, 17 statt 11 Formationsabschnitte, vier statt drei verwendete Formen. Die Zeitpunkte enthalten unregelmäßige Werte wie 12,16 und 29,5 Sekunden. [Auditdaten](auto-movement-variety.json).

Grenze: Auch danach bleibt in diesem Analyseplan eine Formation ungefähr 36 Sekunden erhalten. Ein Formationsname allein beschreibt nicht die gesamte laufende Bewegung. Bei ähnlichen oder wenig aussagekräftigen Analysewerten erzwingt die Änderung bewusst keine neue Form. Ein visueller Abnahmetest an der konkreten Anlage mit acht Moving Heads und vier statischen Quellen steht aus.
