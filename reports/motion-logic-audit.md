# Bewegungslogik: Symmetrie, Sichtbarkeit und Kontinuität

## Bestätigte und korrigierte Fehler

### 1. Wandernde Gruppe verschwindet bei Paarsymmetrie

Die gespiegelte rechte Hälfte wird rekursiv aus der linken berechnet. Der wandernde Auswahlbereich lief dennoch über die gesamte ursprüngliche Rangfolge. Sobald er in die rechte Hälfte gelangte, war kein ausgewertetes Mitglied mehr ausgewählt. Reproduktion: acht Köpfe, Energie 0,5, Phase ca. 4,02 rad; maximaler Gruppenpegel 0 trotz laufender Bewegung.

Die Auswahl läuft jetzt über vollständige Paare. Bei nur einem Paar bleibt dieses aktiv. Quell-Dimmer und explizite Blackouts werden nicht verändert.

### 2. Frage/Antwort verliert den Antwortteil

Die Antwort war der rechten Hälfte zugeordnet. Unter Paarsymmetrie wurde diese Berechnung durch eine Kopie der linken Hälfte ersetzt. Bei Passagefortschritt 0,75 fiel dadurch jede Lampe auf 0,15, statt die Antwortgruppe hervorzuheben.

In gepaarten Formationen wechseln jetzt vollständige Paare zwischen Frage und Antwort. Die ungespiegelte Links-/Rechts-Variante bleibt erhalten. Bestehende Tests hatten nur die ungespiegelte Variante geprüft.

### 3. Sprung beim neutralen Ausladungsfaktor

Bei `extent === 1` blieb die Geometrie unverändert, unmittelbar daneben wurde eine normalisierte tanh-Kurve angewendet. Diese Kurve entspricht bei 1 nicht der Identität. Bei parallel-sweep führte 1 → 1,000001 zu einer Zielverschiebung von rund 0,0627 in normierten Raumkoordinaten. Insbesondere Akzente oder Vorbereitungen können diese Grenze kreuzen.

Eine stetige rationale Abbildung ersetzt die Umschaltung: bei 1 exakt identisch, feste Randpunkte, kontinuierliche Änderung ober- und unterhalb von 1.

## Prüfung

Alle 15 Katalogformen wurden numerisch auf endliche, begrenzte Koordinaten, Paarsymmetrie und lokale Bewegungskontinuität geprüft. Mehrere gerade und ungerade Gruppengrößen; vollständiger Zyklus der wandernden Auswahl; vollständige Frage-/Antwortübergabe; Ausladung auf beiden Seiten des Neutralpunkts.

Gesamte Testsuite: **888 bestanden**, keine Fehler. `git diff --check` ohne Befund. Neue Tests: `test/dmx-paired-catalog.test.mjs`.

Bewegungsplan 14, Show-Cache 49. Keine Änderung am Quell-Dimmer oder an Motorgrenzen. Dies ist eine gezielte numerische Prüfung der Choreografie, keine vollständige visuelle Abnahme aller Raumgeometrien, Ruhezonen oder GPU-Effekte.
