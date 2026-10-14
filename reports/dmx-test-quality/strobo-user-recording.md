# Analyse der tatsächlichen Strobo-Aufnahme

Quelle: __mock/anydj-preview-2026-09-29_00.47.05.mp4, Dauer 21,269 Sekunden, 1920 × 1080, mit Audiospur.

Untersucht als zeitlich geordnete Bildfolgen mit vier Bildern pro Sekunde sowie einem größeren Einzelbild. Dunkle Detailübersichten wurden zum Erkennen der Geometrie aufgehellt; Helligkeitseindrücke wurden zusätzlich am unveränderten Einzelbild geprüft. Keine auditive Beurteilung: Aussagen über die genaue Zuordnung zu hörbaren Instrumenten sind hier nicht belegt.

## Sichtbares Ergebnis

- Bei Aufnahmezeit 0–5 Sekunden dominieren farbige Bodenflächen und nach unten gerichtete Kegel. Dazwischen liegen fast dunkle Bilder und kurze weiße Gruppen, beispielsweise um 0,75 und 4,25 Sekunden.
- Um 10–15 Sekunden bleibt die sichtbare räumliche Grundstruktur ähnlich, während gelbe und cyanfarbene Bilder sowie dunkle Zwischenzustände wechseln. Es ist keine ähnlich deutlich entwickelte Abfolge unterschiedlicher Strahlenformationen wie im untersuchten Referenzausschnitt erkennbar.
- Um 15–20 Sekunden setzt sich dieses Verhalten fort: größere farbige Bilder, kurze andersfarbige Gruppen, Dunkelphasen. Die Farb- und Helligkeitswechsel treten stärker hervor als eine räumliche Entwicklung.
- Im Einzelbild um 0,75 Sekunden ist Deck A mit dmx-test.mp3 und Lichtshow Strobo sichtbar; der Song steht ungefähr bei 0:49. Deck B ist pausiert. Die Aufnahme zeigt damit ungefähr den Bereich 0:48–1:09, vorbehaltlich Sprüngen innerhalb der Aufnahme.

## Vergleich mit der Referenz

Im untersuchten Ausschnitt der zweiten Referenz, etwa 1:39–1:44, sind blaue Fächer und seitliche Strahlenbilder als deutlich unterschiedliche räumliche Figuren lesbar. Ihre wiederkehrende Abfolge und die reduzierten roten Antworten ergeben ein erkennbares Motiv. In der Nutzeraufnahme dominieren dagegen ähnlich wirkende Kegel und Bodenflächen, deren Sichtbarkeit wechselt.

Die Clips zeigen unterschiedliche räumliche Aufbauten und Songstellen. Dies ist ein Vergleich der visuellen Gestaltung, kein zeitlich synchronisierter A/B-Vergleich.

## Abgleich mit dem Code

Die Strobo-Planung beschreibt ihre Geometrie derzeit hauptsächlich durch normierte x/y-Werte je Geräterang. Sichtbarkeit und Rollen werden separat zugeordnet. Daraus folgt nicht automatisch eine gemeinsam lesbare räumliche Strahlenfigur über unterschiedliche Montagepositionen hinweg.

Zusätzlich liefert strobeComposition immer wallBlend:0. Für Geräte mit einem expliziten Wandbereich übernimmt wallChoreography deshalb keine Wandfigur. Das ist ein konkreter zu prüfender Integrationspunkt, aber ohne den gespeicherten Raumplan der Aufnahme noch keine bestätigte Erklärung aller nach unten gerichteten Kegel. Die allgemeine Raumprojektion besitzt weitere Winkel- und Oberflächenpfade; pauschal alle Ziele als Bodenpunkte zu bezeichnen wäre falsch.

Die bisherigen Offline-Messungen im Club-Preset belegen weder die Geometrie im aufgenommenen Aufbau noch deren visuelle Lesbarkeit. Das Zusammenfassen von Zeitabschnitten konnte allein diesen Unterschied nicht beheben.

## Konsequenz

Die nächste Umsetzung muss ganze räumliche Strahlenbilder im tatsächlichen Ausgabepfad definieren und deren Sichtbarkeit komponieren. Abnahmekriterium ist zuerst, dass beispielsweise ein Fächer, eine Diagonale und eine Folge wandernder Strahlenpaare auch aus der aufgenommenen Perspektive eindeutig unterscheidbar erscheinen. Erst darauf lässt sich eine musikalisch nachvollziehbare Abfolge aufbauen.

Automatisch und Show dienen als funktionierende Vergleichspfade. Ihre gemeinsame Darstellung oder musikalische Planung sollte nicht aufgrund dieses Strobo-Befunds pauschal verändert werden.

In diesem Analyseschritt wurde kein Produktionscode verändert.
