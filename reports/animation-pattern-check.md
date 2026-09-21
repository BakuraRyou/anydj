# Automatische Animationsmuster

Die automatische Show plant fünf Bewegungsmuster aus Abschnitt, lokalem Stil
und Motiv: ruhige Fläche, Lichtwelle, Wechselakzent, Aufbau und kurzer Impuls.
Lange Abschnitte werden an erkannten Taktanfängen unterteilt (vier Takte,
mindestens sechs Sekunden zwischen internen Grenzen); ohne Taktanfänge werden
Gruppen ausgewählter Akzente verwendet. Kurze musikalische Abschnitte bleiben
kurz. Der Beat-Detektor und die Auswahl der rhythmischen Ereignisse bleiben
unverändert. Alte Pläne ohne Muster behalten ihre bisherige Hüllkurve.

## Verfeinerung

- Stilauswertung pro visueller Phrase statt einmal pro gesamtem Abschnitt;
  hinreichend deutliche akustische/orchestrale/ambient Stilwerte bevorzugen auch
  in intensiven Abschnitten Wellen und Wechselakzente.
- Keine direkten Musterwiederholungen, sofern die Auswahl mehrere Muster bietet.
  Ruhige Flächen und durchgehende Aufbauten bleiben bewusst zusammenhängend.
- Aufbauten steigern sich über den ganzen musikalischen Abschnitt, ohne bei
  jeder visuellen Phrase neu zu beginnen.
- Intensive Abschnittseinsätze starten bei nicht sanftem Stil mit einem Impuls.
  Bei internen Musterwechseln mischt der erste Akzent beide Hüllkurven zu gleichen
  Teilen. Dies ist kein vollständiger Crossfade der gesamten Lichtszene.
- Erkannte Taktanfänge erhalten bei Wechselakzenten die stärkere Variante.
  Lichtwellen enden kontinuierlich bei null statt mit einem Restwert abzubrechen.
- Neue Regressionen prüfen Stilwechsel innerhalb eines Abschnitts, Aufbauverlauf,
  Wellenende, Einsatz, Taktanfänge und die gemischte Übergangshüllkurve.

## Prüfung

- 161 Tests erfolgreich, einschließlich unterschiedlicher Hüllkurven,
  reproduzierbarer Sprungpositionen, unverändertem Beat-Raster, Stille und
  Helligkeitslimits. Party/Disco behalten Muster und Beat-Zeitpunkte.
- Stummer Browser-Test im Demo-Modus mit RobbieWilliamsBoddies.mp3
  (263,697 Sekunden), echtem lokalem Beat- und Stilmodell: Basisvorbereitung
  8,663 Sekunden, 129 Stilfenster, 38 Musterabschnitte, alle fünf Muster vertreten.
- Profilwechsel: Automatisch unter der Timerauflösung, Party 2,4 ms, Disco 1,7 ms.
- Rohmessung: `animation-pattern-browser-check.json`.

Die optionale All-In-One-Strukturanalyse ist in dieser Laufzeit nicht enthalten.
Keine echten Lampen angesteuert. Die visuelle und musikalische Wirkung im Raum
muss praktisch beurteilt werden; diese Prüfungen belegen keine optimale Show.

## Musikalischer Bewegungscharakter (Show-Version 13)

Die Musterauswahl verwendet zusätzlich die bereits vorhandene akustische
Anschlagbewertung für die ausgewählten Beats. Bei überwiegend ausgeprägten
Anschlägen bleiben Impuls/Wechselakzent erhalten, statt allein zur Abwechslung
in eine weiche Welle zu wechseln. Bei schwachen Anschlägen werden Welle und
Wechselakzent bevorzugt. Ruhige Abschnitte, Aufbauten und lokale Stilpräferenzen
bleiben berücksichtigt. In treibenden Phrasen wird der erste Akzent beim
Musterwechsel nicht durch die vorherige Hüllkurve abgeschwächt.

Beat-Zeitpunkte, Farblogik und DJ-Profilglättung wurden dabei nicht geändert.
Es handelt sich um eine Gestaltung anhand akustischer Merkmale, nicht um eine
neue Instrumententrennung oder einen Nachweis subjektiv optimaler Animationen.
Die Berechnungsversion wurde erhöht, damit alte gespeicherte Shows nicht als
aktuelles Ergebnis gelten.

164 Tests bestanden. Die neue Regression prüft innerhalb eines Abschnitts
starke und weiche Anschläge, passende Muster und reproduzierbare Ergebnisse.
Der stumme Demo-Browsertest prüft zusätzlich Neuberechnung, Speicherung,
Wiederherstellung und Queue-Crossfades ohne Browser-Ausnahmen. Keine visuellen
Tests an echten Lampen und keine neue Messung mit einer echten Musikaufnahme.
