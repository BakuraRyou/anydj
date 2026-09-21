# Musikbezogene Farbdynamik – Show-Version 14

Ursache des Lauflicht-Eindrucks: Das Disco-Profil mischte eine feste Vierfarbenfolge
anhand des globalen Akzentzählers in die berechneten Songfarben. Zusätzlich wechselte
die Grundshow in intensiven Passagen bereits nach jeweils zwei ausgewählten Akzenten
das Farbpaar – auch wenn Klang und Energie unverändert blieben.

Änderungen:

- Disco behält die Farbkontur der berechneten Show und verstärkt Sättigung,
  Helligkeitskontrast und Akzentgeschwindigkeit.
- Stabile Songteile halten ihre Farbfamilie. Phrasengrenzen erlauben einen neuen
  Farbwechsel nur bei gemessener Änderung der mittleren Energie oder Klangfarbe.
- Farbwechsel liegen auf ausgewählten musikalischen Akzenten, bevorzugt erkannten
  Taktanfängen. Ein reiner Beat-Zähler löst keinen Wechsel mehr aus.
- Die Farbkontur bewegt sich innerhalb eines begrenzten Bereichs; rhythmische
  Schläge steuern hauptsächlich die Helligkeit. Aufbauten öffnen den Farbbereich
  über den Abschnitt, ruhige Passagen bleiben zurückhaltend.
- Größere Farbbewegungen werden langsamer geglättet. Wiederkehrende Songteile
  behalten ihre Motivzuordnung.
- Show-Version auf 14 erhöht: Alte gecachte Show-Pläne werden nicht weiterverwendet.

Validierung:

- Vollständige Testsuite: 185 Tests bestanden. Anschließend zusätzlicher Test für
  wiederkehrende Refrain-Farben samt beiden anderen Farbtests bestanden.
- Neue Prüfungen: feste Klangfarbe bleibt auch im Discomodus in derselben Farbfamilie;
  konstante Beats lösen keinen Farbzyklus aus; eine gemessene Änderung einer Phrase
  löst einen Wechsel aus; wiederkehrender Refrain erhält seine ursprüngliche Familie.
- Browserprüfung von Show-Cache, Neuberechnung, zwei automatischen Crossfades,
  Profil-/Show-Nutzung und Desktop-/Mobil-Layout bestanden; keine Browserfehler.

Die Prüfungen verwenden synthetische Audiosignale und simulierte Lampen. Die
ästhetische Wirkung am vollständigen Lieblingslied muss anschließend an der
echten Lampe beurteilt werden; musikalische Struktur-/Stimmungserkennung bleibt
eine Schätzung. Die Änderung verbessert die Interpretation vorhandener Analyse,
sie ersetzt oder verbessert nicht die zugrunde liegenden Analysemodelle.
