**Prüfung der Übergangsplanung – 21.09.2026**

Die gewünschte Funktion ist eine vorausschauende Planung für das konkrete Songpaar: Sobald der nächste Titel feststeht, werden Ausstieg, Einstieg, Überblenddauer und Übergangsart gemeinsam bewertet. Das ist sinnvoll mit den vorhandenen Analysedaten umsetzbar. Eine erneute Instrumententrennung pro Paar ist dafür nicht erforderlich.

**Was bereits vorhanden ist**

`plannedTransition()` in [dj.js](../public/dj.js) berechnet bereits einen Paarplan, sobald beide Decks eine Show besitzen. Bei Warteschlangenbetrieb muss das zweite Deck zum nächsten Eintrag gehören. Der Plan wird anhand der beiden Planobjekte, Cue, Wiedergaberaten, eingestellten Dauer und aktiviertem Musikmodus zwischengespeichert. Nach einer Strukturverfeinerung werden die Planobjekte ersetzt und der Paarplan neu berechnet. Umordnung, neue Cues und Tempoänderungen werden über diese Bedingungen berücksichtigt.

[musical-transition.js](../public/musical-transition.js) vergleicht bei vorhandenen Instrumentendaten 24 Stichproben pro Überlagerung: Gesangs- und Bassüberschneidung, Energieunterschied und Schlagzeugaktivität. Zusätzlich berücksichtigt es die aus lokalen Beatabständen erwartete Rhythmusdrift. Daraus entstehen sanfter Übergang, Bassübergabe oder eine verkürzte wirksame Überlagerung. Die Bassübergabe wird bereits über einen separaten Filter auf der AudioContext-Zeitachse ausgeführt.

Die derzeitige Implementierung geht damit über den älteren [Übergangsaudit](musical-transition-audit.md) hinaus. Dessen Aussagen „kein Songvergleich“ und „kein Basswechsel“ beschreiben einen früheren Stand.

**Die entscheidenden Grenzen**

| Punkt | Aktueller Stand | Musikalische Konsequenz |
|---|---|---|
| Ausstieg | Suche nur nahe Dateiende minus eingestellter Fade-Dauer; höchstens vier reale Sekunden früher | Ein geeigneter Beginn des Outros oder ein früherer Phrasenwechsel fällt oft aus der Suche |
| Einstieg | Cue bis maximal zwei Sekunden dahinter | Ein passender instrumentaler Einstieg außerhalb dieses Fensters wird nicht verglichen |
| Dauer | Eingestellte Sekunden; nur durch Dateiende gekürzt | Keine Auswahl zwischen kurzen Übergaben und mehreren ganzen Takten/Phrasen |
| „Kurze Überlagerung“ | Crossfader bewegt sich hauptsächlich zwischen 30 und 70 Prozent der geplanten Zeit | Ein Acht-Sekunden-Plan hat etwa 3,2 Sekunden aktive Crossfaderbewegung, ist aber kein neu optimierter 3,2-Sekunden-Plan |
| Bewertung und Ausführung | Instrumentenkollisionen werden mit einer gemeinsamen symmetrischen Gewichtung bewertet, der Übergangsstil erst danach gewählt | Die tatsächlich ausgeführte Crossfader-/Basskurve wird nicht vollständig in der Kandidatenbewertung abgebildet |
| Tempo | Wiedergaberaten werden berücksichtigt, aber nicht automatisch verändert | Unterschiedliche Tempi bleiben bei längeren Überlagerungen auseinanderlaufend |
| Späte Entscheidungen | Aktuelle Wiedergabeposition ist beim gecachten Auto-Plan kein Suchparameter | Wird der nächste Titel spät geladen, kann der gewählte Zeitpunkt schon vorbei sein; dann startet die Übergabe sofort |
| Startpräzision | 25-ms-Steuertimer plus asynchrones Starten des nächsten Audiodecoders | Ein theoretisch passender Taktbeginn ist noch kein samplegenau geplanter Audiostart |
| Qualität | `confidence: analyzed` bedeutet hauptsächlich, dass Instrumentendaten benutzt wurden | Dies ist keine kalibrierte Aussage darüber, wie gut der Übergang klingt |

**Konkrete Prüfung**

17 vorhandene Tests für Übergangsplanung, Beat-Sync und Statusdarstellung bestanden. Zusätzlich wurde ein synthetisches Paar mit jeweils 240 Sekunden, 120 beziehungsweise 126 BPM und einem Outro ab Sekunde 208 ausgewertet. Der aktuelle Plan beginnt bei Sekunde 232 und dauert acht Sekunden. Sekunde 208 liegt außerhalb des Suchfensters; der Planner kann diesen Ausgangspunkt nicht bewerten. Das belegt die Suchbegrenzung, nicht, dass ein früherer Übergang bei echter Musik zwingend besser wäre.

120 gegenüber 126 BPM ergeben ohne Anpassung 0,8 Beats Drift über acht Sekunden. Um den zweiten Titel auf 120 BPM zu bringen, wäre rechnerisch `120 / 126 = 0,95238` als Wiedergaberate nötig, also etwa −4,76 Prozent. Ob eine solche Änderung gewünscht ist oder gut klingt, lässt sich daraus nicht ableiten.

Die bestehende, enge Paarbewertung benötigte auf dem i9-14900HX bei diesem Test nach zehn Aufwärmläufen über 100 Durchläufe einen Median von rund 0,108 ms und ein 95. Perzentil von 0,154 ms. Das sind reine Berechnungszeiten für synthetische, bereits vorliegende Daten; kein Hörtest und keine Messung eines erweiterten Planners. Die aufwendige Vorarbeit bleibt die einzelne Songanalyse.

**Empfohlene Erweiterung**

1. **Frühzeitig vorplanen.** Sobald der nächste lokale Titel feststeht, vorhandene Beat-, Abschnitts- und Instrumentendaten beider Songs verwenden. Zunächst einen Basisplan erstellen, nach vollständiger Analyse einmal verfeinern. Kurz vor dem Start den Plan stabil halten; bei Nutzeränderungen, Sprüngen oder verpasstem Termin neu bewerten.
2. **Sinnvolle Zeitfenster statt freier Songkürzung.** Im normalen Auto-Modus die letzte passende musikalische Passage untersuchen. Der Nutzer kann festlegen, ob Songs möglichst ausgespielt werden oder ein früher Wechsel erlaubt ist. Eine aktuelle Position mit Vorbereitungsreserve begrenzt die Kandidaten. Einen expliziten Cue weiterhin respektieren; automatisches Überspringen eines Intros separat auswählbar machen.
3. **Dauer mitoptimieren.** Mehrere Dauern aus tatsächlich erkannten Takt- und Phrasengrenzen vergleichen, beispielsweise zwei, vier oder acht Takte, sofern Raster und verfügbare Songteile das tragen. Nicht pauschal vier Beats pro Takt unterstellen. Bei Gesangskollisionen oder starkem Tempounterschied zusätzlich eine kurze Übergabe prüfen.
4. **Kandidaten samt Ausführung bewerten.** Für jedes Paar aus Ausstieg, Einstieg, Dauer und Übergangsstil die tatsächlichen Lautstärke- und Basskurven berücksichtigen. Gesangsüberschneidung, konkurrierende Bässe, rhythmische Drift, Energieloch und abgeschnittene musikalische Abschnitte gegeneinander abwägen. Erklärbare Gründe mitliefern, keine vermeintlich präzise Qualitätsnote ohne Hördaten.
5. **Überblendgeschwindigkeit und Songtempo trennen.** Die Dauer des Fades darf automatisch empfohlen werden. Automatische Tempoanpassung wäre eine eigene, ausdrücklich aktivierte Option mit engem Änderungsbereich und verlässlichem Beat-Raster. Originaltempo bleibt sonst bestehen; bei inkompatiblen Tempi lieber eine kürzere Überlagerung. Die bestehende bewusste Trennung ist im [Bericht ohne Tempoänderung](musical-transitions-no-tempo.md) dokumentiert.
6. **Plan sichtbar machen.** Etwa: „Geplant in 24 s · vier Takte · Bassübergabe · wenig Gesangsüberschneidung · Originaltempo“. Diese Zahlen wären Ergebnis des konkreten Plans, keine festen Vorgaben. Manuelles „Überblenden“ bleibt eine sofortige Nutzeraktion.

**Validierung vor Aktivierung**

Erst die neue Bewertung gegen die bestehende vergleichen, ohne das Wiedergabeverhalten zu ändern. Hörvergleiche sollten gleiches Tempo, unterschiedliche Tempi, doppelte Gesangspassagen, instrumentale Intros, abrupte Enden und unvollständige Analyse abdecken. Zusätzlich müssen Queue-Umordnung, Seek, Loop, verspätetes Laden, Tempo-/Cue-Änderungen, Abbruch und natürliches Songende reproduzierbar geprüft werden. Ein niedrigerer heuristischer Kollisionswert allein ist kein Nachweis eines besseren Übergangs.

Diese Prüfung ändert die aktuelle Wiedergabelogik nicht. Der erste Umsetzungsschritt sollte ein erweiterter Paarplan mit vorgeschlagenem Start und variabler Dauer sein; neue Effekte oder automatische Tempoänderungen sind dafür nicht nötig.

## Umsetzung: adaptive Paarplanung

Die Übergangsdauer bietet jetzt standardmäßig **Automatisch**. Mit aktivierten musikalischen Übergängen, Instrumentverläufen beider Titel und verwertbaren Taktrastern vergleicht die Planung zusätzliche Ausstiege im letzten Viertel des Titels, begrenzt auf die letzten 60 Echtzeitsekunden. Der bisherige Ausstieg bleibt ein Kandidat. Verglichen werden Distanzen über 1, 2, 4 und 8 erkannte Takte sowie eine bevorzugte Dauer von 8 Sekunden; automatische Überblendungen sind auf 2–24 Sekunden und die verfügbaren Restlaufzeiten begrenzt. Sehr kurze Restlaufzeiten nutzen den bisherigen gekürzten Übergang.

Zeitpunkt, Dauer und Kurve werden gemeinsam bewertet: Gesangs- und Bassüberschneidung, Rhythmusdrift, Energiedifferenz, Abschnitts- und Taktgrenzen sowie übersprungene Restlaufzeit. Die Bewertung verwendet die lineare Crossfaderkurve bzw. die kürzere Handoverkurve. Die Bassabsenkung teilt sich ihre Hüllkurvenfunktion mit der tatsächlichen Audioautomation. Dies bleibt eine Heuristik auf Instrumentaktivität; es ist weder eine genaue Simulation des hörbaren Mixes noch eine harmonische oder semantische Phrasenanalyse.

Das Originaltempo bleibt unverändert. Der bestehende Eingangsbereich vom Cue bis maximal zwei Sekunden danach bleibt erhalten. Explizite Sekundenwerte behalten die bisherige Dauerplanung. Ohne ausreichende Analysedaten bleibt die bisherige Planung mit bis zu acht Sekunden aktiv. Der manuelle Überblenden-Knopf startet weiterhin sofort.

Paarpläne werden zwischengespeichert. Titel, Queue-Eintrag, Analyseobjekte, Cue, Geschwindigkeiten und Einstellungen gehören zum Cache-Schlüssel. Ein Seek verwirft den Plan; neu berechnete Ausstiege liegen nicht vor der aktuellen Abspielposition. Die Statusanzeige nennt Zeitpunkt und Dauer, ihr Tooltip begründet die Auswahl.

Validierung: zusätzliche synthetische Tests für einen gesangsfreien früheren Abschnitt, Dreiertakte, späte Bereitstellung, manuelle Starts, unterschiedliche Abspielgeschwindigkeiten, Cue-Grenzen und Fallbacks. Vollständige Testsuite: 314 Tests erfolgreich. Browsercheck mit automatischer Dauer und Warteschlange erfolgreich, inklusive tatsächlicher Bassautomation und unverändertem Tempo. Die musikalische Qualität sollte zusätzlich anhand unterschiedlicher echter Songpaare gehört werden; die Tests belegen technische Eigenschaften, kein subjektives Qualitätsurteil.
