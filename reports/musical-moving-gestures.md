# Schwenker mit musikalischem Anlass

23. September 2026 · Bewegungsspur-Version 5.

Rückmeldung: Die Farben und Helligkeit passen, Schwenker wirken dagegen häufig
unmotiviert. Bisher konnte nahezu jeder ausreichend starke Lichtakzent eine
weitere Position der Bewegungsfigur auslösen. Eine neue visuelle Phrase startete
die Positionsfolge erneut, auch wenn die Musik unverändert blieb.

Die automatische Bewegung analysierter Songs wählt nun räumliche Gesten separat:

- Die erste geeignete musikalische Passage eröffnet eine Formation.
- Eine veränderte Energie, Klangfarbe, Bewegungscharakteristik oder ein eindeutig
  veränderter führender Instrumentenanteil erlaubt eine neue Geste.
- Ein gegenüber dem Median seiner Phrase deutlich stärkerer Lichtakzent darf
  eine Geste auslösen. Gewöhnliche gleichmäßige Akzente halten die Formation.
- Ein Aufbau erlaubt Bewegungen auf erkannten Taktanfängen nur bei tatsächlich
  ansteigender Instrumentenintensität; ein Abschnittslabel allein genügt nicht.
- Vorlauf höchstens 0,6 Sekunden, bei ruhigen Gesten 1,5 Sekunden. Ist die
  Zielposition unter den Geschwindigkeitsgrenzen nicht erreichbar, wird die
  Wegstrecke verkürzt. Zwischen Gesten halten die Köpfe ihre Position.

Die Auswahl gilt für alle Grundstimmungen im automatischen Modus. Explizite
Bewegungsmodi und ältere Pläne ohne Bewegungsanalyse behalten ihre bisherigen
Regeln. Farben, Dimmerkurven und Show-Analyse werden nicht verändert. Die bereits
in der vorigen Iteration vorgenommenen Änderungen bleiben im Arbeitsstand.

Zusätzliche Regressionen prüfen gehaltene Formationen über künstliche
Phrasengrenzen, starke Einzelakzente, Klangwechsel, echte gegenüber nur benannten
Aufbauten, begrenzten Vorlauf, reproduzierbare Positionssprünge und unveränderte
Eingabedaten. Die Geschwindigkeitstests bleiben aktiv.

Validierung: `npm test` — 398 Tests erfolgreich; `git diff --check` ohne Befund.

Dies sind gestalterische Heuristiken. Eine reale Hör-/Seh-Abnahme mit den
beanstandeten Musikpassagen steht aus. Die Prüfung behauptet keine universell
passende räumliche Interpretation. Zum Ausprobieren reicht ein Neuladen der
DJ-Seite: Bewegungsspuren werden pro Sitzung neu vorbereitet; eine neue
Instrumentenanalyse ist für bereits vorbereitete aktuelle Shows nicht nötig.
