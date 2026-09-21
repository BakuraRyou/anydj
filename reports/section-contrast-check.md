# Abschnittsrollen und musikalischer Kontrast

Ursache: Die bisherige Choreografie behandelte kräftige Strophen und Refrains
nahezu gleich. Hohe Schlagzeugaktivität erlaubte beiden dieselbe Farbwechseldichte,
und die Auswahl des maximal kontrastierenden Farbpartners ergab oft dasselbe
Farbpaar, lediglich in umgekehrter Reihenfolge.

Die allgemeine Gestaltung trennt jetzt akustische Intensität und Abschnittsrolle.
Ein als Refrain/Solo geschätzter Abschnitt wird nur hervorgehoben, wenn er selbst
hinreichend aktiv ist und im Vergleich zu den Strophen nicht deutlich abfällt.
Dann erhalten Strophen eine unterstützende Rolle: weniger Farbwechsel, engeres
Farbpaar und geringere Lichtintensität. Der Refrain nutzt den vollen Kontrast.
Vor dem Übergang von unterstützender Strophe zu hervorgehobenem Refrain nimmt
das Grundlicht kurz zurück. Stille und tatsächlich ruhige Abschnitte bleiben
zurückhaltend. Ohne geeignete Strukturschätzung bleibt die akustische Gestaltung.

Die Regeln verwenden keine Dateinamen, Künstler oder festen Songzeitpunkte.
Die Strukturrollen bleiben Schätzungen. Hooks ohne korrekt erkannte
Abschnittsrolle sind damit nicht als zuverlässig erkannt behauptet.

## Vollständige lokale Prüfdateien

| Datei | Dauer | Analyse gesamt |
|---|---:|---:|
| RobbieWilliamsBoddies.mp3 | 263,70 s | 104,29 s |
| djsfrommars20years.mp3 | 275,53 s | 120,25 s |

CPU, vollständige Analyse ohne Ergebnis-Cache, FFmpeg-Dekodierung sowie derselbe
Show-Worker-Code wie in der App. Modell- und Browser-Zeitbudgets unverändert.
Dies sind Messungen auf diesem Rechner, keine Garantie für andere Systeme.

Bei Bodies erhalten die etwa 15,36 Sekunden langen Abschnitte 31,13–46,49 s
(Strophe) und 69,53–84,89 s (Refrain) im Disco-Profil acht bzw. 32 Farbereignisse.
Die Strophe bleibt trotz hoher akustischer Intensität unterstützend. Die ruhige
Passage 184,73–200,09 s erhält keine zusätzlichen Farbereignisse. Beim Mashup
werden aktive Refrains ebenfalls hervorgehoben; ein schwächerer geschätzter
Refrain bei 121,03–142,89 s bleibt neutral. Diese Zeitpunkte sind Prüfergebnisse,
keine Bedingungen im Programm.

[Rohmesswerte](section-contrast-benchmark.json).

## Validierung

202 Node-Tests bestanden. Zwei neue musikalische Regressionen prüfen identische
Akustik mit unterschiedlichen Abschnittsrollen sowie eine falsch als Refrain
bezeichnete Ruhepassage. Browserprüfungen für Abschnittseditor und DJ-Cache,
Wiedergabe und Layout bestanden. Manuelle Abschnittseinstellungen bleiben wirksam.
Die physische Lichtwirkung wurde nicht bewertet.

Bei der Browserprüfung wurde zusätzlich eine Inkonsistenz der App-Umbenennung
sichtbar: Das Frontend sendete X-AnyDj-Local, der Server akzeptierte nur
X-WiZ-Local. Beide Namen werden jetzt akzeptiert; fehlender Header wird weiterhin
abgewiesen und ist getestet. Eine versehentlich umbenannte Hardware-SSID im
Verbindungstest wurde auf den tatsächlichen WiZConfig-Namen korrigiert.

Planversion 17 sorgt für die Erneuerung der vorberechneten Shows.
