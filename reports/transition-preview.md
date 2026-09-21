# Übergangsvorschau und automatische Variantenwahl

Unter „Übergänge“ öffnet „Übergang ansehen & probehören“ einen Dialog mit Songnamen, Ausstiegs- und Einstiegsposition, Dauer, Auswahlbegründung und interaktivem Lautstärkeverlauf. Die Grafik stellt die Überblendkurve dar, nicht den gemessenen Audiopegel. Eine Bassübergabe wird zusätzlich erklärt.

Die Hörprobe nutzt eigene Media-Elemente und einen eigenen AudioContext. Sie übernimmt die gewählten Kanalpegel, EQ-Einstellungen, Abspielraten und die Übergangshüllkurven. Sie beginnt bis zu zwei Sekunden vor dem Wechsel und endet bis zu zwei Sekunden danach. Deckpositionen und Warteschlange bleiben unverändert. Ausgabe: Systemausgang mit separater Probelautstärke; beide Decks müssen pausiert sein. Beim Start eines Decks, Stoppen oder Schließen endet die Probe. Sie ist eine Momentaufnahme des beim Öffnen ausgewählten Plans; erneut öffnen übernimmt einen aktualisierten Plan. Es gibt noch kein separates Kopfhörer-Probehören während laufender Decks.

In der adaptiven Paarplanung konkurriert nun ein kurzer, 250 ms geglätteter Wechsel mit den bisherigen Überblendvarianten. Er wird am selben Ausgangs-/Eingangskandidaten bewertet. Aktiver Gesang am Schnitt, Energiesprung und übersprungene Restlaufzeit erhöhen seine Kosten; eine Abschnittsgrenze senkt sie. So bleibt bei kompatiblen Rhythmen eine Überblendung möglich, während bei stark auseinanderlaufenden Rhythmen ein kurzer Wechsel gewinnen kann. Feste Sekundenwerte bleiben beim bisherigen Verhalten. Es erfolgt keine automatische Änderung von Tempo oder Tonhöhe.

Die Auswahl bleibt eine Heuristik. Insbesondere werden keine vollständigen Gesangszeilen oder harmonischen Phrasen semantisch erkannt; die vorhandenen Abschnitts-, Beat- und Instrumentdaten liefern Näherungen.

Validierung: 315 Tests erfolgreich. Browserprüfung für Darstellung, tatsächliche Hörprobenwiedergabe samt Vorlauf, Fortschritt und Stoppen sowie unveränderte Deckpositionen und Queue erfolgreich. Synthetischer Vergleich belegt kurze Übergänge bei konkurrierenden Rhythmen und längere Überblendung bei kompatiblen Rhythmen.

## Erweiterung: Kontext, Einstieg, Tonart und Alternativen

Die adaptive Bewertung bezieht nun Fenster vor und nach dem hörbaren Wechsel ein. Eine Gesangspause muss über ein 0,8-Sekunden-Fenster anhalten; Energie vor dem Übergang wird mit der Energie bis zwei Sekunden nach dem Übergang verglichen. Ein fortgesetzter Energieanstieg wird als möglicher unterbrochener Aufbau gewertet. Acht-Takt-Gruppen werden nur mit einer erkannten Abschnittsgrenze als Anker schwach gewichtet. Das ist keine semantische Erkennung von Gesangszeilen.

Die optionale Einstiegssuche reicht bis 16 oder 30 Sekunden (Standard weiterhin zwei Sekunden). Explizit gesetzte Cues sperren den Einstieg exakt; Shift-Klick auf „Cue setzen“ hebt die Sperre auf. Feste Sekundenwerte behalten die bisherige Planung mit dem engeren Eingangsbereich; gesperrte Cues gelten auch dort.

Die vorhandenen Chroma-Fenster liefern zwischengespeicherte Tonartschätzungen pro zehn Sekunden. Wiederverwendet wird der bereits vorhandene einfache Dur-/Moll-Profilvergleich. Unsichere Schätzungen werden ignoriert. Harmonisch weiter entfernte Schätzungen erhöhen moderat die Kosten längerer Überblendungen; bei kurzen Wechseln entsteht kein zusätzlicher Harmonieaufschlag. Es werden keine Audiodateien, Tempi oder Tonhöhen geändert und keine zusätzlichen KI-Modelle geladen.

Bis zu drei unterschiedlich platzierte oder gestaltete Vorschläge stehen in der Hörvorschau bereit. Übernahme ersetzt ausschließlich den aktuellen, noch gültigen Paarplan. Veränderte Einstellungen, Tracks, Analyseobjekte und Cues oder ein verstrichener Start verhindern die Übernahme eines alten Vorschlags. Eine explizit aktivierte Stilpräferenz wirkt als kleiner Bonus und bleibt in den Einstellungen rücksetzbar.

Validierung dieser Erweiterung: 321 Tests erfolgreich; Browserchecks für Alternativen, Übernahme, gespeicherte Präferenz, Ablehnung veralteter Vorschläge, isolierte Hörprobe und exakten manuellen Cue erfolgreich. Mobile Darstellung bei 390 Pixel Breite ohne horizontalen Überlauf geprüft. Die musikalische Gesamtqualität erfordert zusätzlich Hörvergleiche mit echten Songpaaren.
