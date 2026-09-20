**Beat This! – lokale Einbindung, 20.09.2026**

Installiert: `beat-this==1.1.0`, Modell `final0`, Python 3.14.4,
PyTorch 2.14.0+cpu und Torchaudio 2.11.0+cpu in `.venv-beat-this/`.
Die Abhängigkeiten importieren erfolgreich; echte Inferenz wurde ausgeführt.
SHA-256 des Modells: `8c328b45f59d8dd3dff219253ff6a8d6482be57d0133a29140e2febbf8eb8331`.

Die vorhandene MP3 `RobbieWilliamsBoddies.mp3` hat etwa 263,70 Sekunden.
Ein direkter Test mit FFmpeg-Mono-Dekodierung benötigte 5,16 Sekunden ab
Python-Programmstart einschließlich Imports und Modellladen: 544 Beats,
138 Taktanfänge. Das vollständige Ergebnis steht in `beat-this-boddies.json`.

Der produktive Weg verwendet stattdessen das im Browser dekodierte Audio,
damit Audioanalyse und Show dieselbe Zeitbasis benutzen. Der tatsächliche
Chrome-Test ergab 544 Beats und 137 Taktanfänge. Unterschiedliche Dekodierung
und Mono-Mischung können Modellentscheidungen verändern; die direkte
FFmpeg-Messung ist deshalb nicht identisch zum Browserergebnis.

Prüfung mit isoliertem Chrome-Profil und Demo-Lampen:

- Die Musikseite berechnet die Show mit Beat This! und erhält alle 544 Beats
  bei erneutem Rendern nach einem Palettenwechsel. Die Helligkeitsbilder bleiben
  dabei identisch.
- Der Editor verwendet dieselben zwischengespeicherten Analysedaten und ist
  anschließend zum Bearbeiten und Starten bereit.
- Der Wechsel zur Standard-Erkennung berechnet die Show neu.
- Keine JavaScript-Ausnahmen im Browser; keine echte Lampe angesteuert.

Die Ergebnisse stehen in `beat-this-browser-check.json`. Der Browsertest lief
mit dem realen Python-Prozess, keine simulierten Beat-Zeitpunkte.

`npm test`: 108 Tests bestanden. Die neuen Tests prüfen Zeitachsenvalidierung,
Erhalt der Beat-Zeitpunkte, leere Beatlisten, binäre PCM-Eingaben, NaN-Abweisung,
Zwischenspeicherung, Zugangscode/Origin/Schreibheader, unverändertes JSON-Limit,
fehlende Installation, defekte Modellausgabe, parallele Anfragen, Abbruch,
Zeitlimit und sichtbaren Browser-Fallback.

Es wurden weder die tatsächliche Lampenlatenz noch die musikalische Richtigkeit
an einer manuell markierten Referenz gemessen. 544 Modell-Beats gegenüber
507 bisherigen heuristischen Ereignissen sind unterschiedliche Ergebnisse,
kein Genauigkeitsnachweis. Der auswählbare Vergleich am selben Lied ist der
nächste praktische Bewertungsschritt. All-In-One wurde nicht installiert.
