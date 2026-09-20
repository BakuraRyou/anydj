# Teststand – Prototyp 0.1.0

Erstellt und geprüft am 19.09.2026.

## Automatisierte Tests

Umgebung: Node.js 22.16.0. Befehl: `npm test`.

16 Tests prüfen Broadcast-Berechnung, lokale IPv4-Validierung, Parametergrenzen, Modellfähigkeiten, echte UDP-Datagramme über Loopback, ungültige Antworten, explizite Gerätefehler, Wiederholungsversuche, Timeouts, HTTP-Steuerung, Web-Zugangscode, Host-/Origin-/Schreibheader-Prüfungen, Speicherung, Serialisierung gleichzeitiger Befehle, Fallbacks für ältere Firmware und den Umgang mit fehlenden Statusantworten.

Die UDP-Gegenstelle ist ein **Testserver**, keine echte WiZ-Lampe. Die Tests prüfen nicht, ob ein bestimmtes physisches Modell oder dessen aktuelle Firmware die Befehle annimmt. Die Broadcast-Adressberechnung wird geprüft; die Gerätesuche wurde nicht in einem realen WiZ-WLAN verifiziert.

## Oberflächentests

Die lokale HTML-/CSS-/JavaScript-Oberfläche wurde in Chromium im Desktopformat (1440 px) und im Handyformat (390 px) gerendert und interaktiv gegen das Demo-Backend geprüft. Geprüft wurden Gerätauswahl, RGB-/Hex-Farbe, Weißtemperatur, Helligkeit, Ein/Aus, Presets, Umbenennen, das Sperren von RGB bei einem simulierten Weißlichtmodell und die Zusammenfassung schneller Regleränderungen. Im geprüften Handyformat gab es keinen horizontalen Überlauf; während der Tests wurden keine JavaScript-Seitenfehler gemeldet.

**Testgrenze:** Browsernavigation ist in der Erstellungsumgebung administrativ gesperrt. Deshalb wurde die Oberfläche zum Rendern direkt in den Browser geladen und ihre HTTP-Aufrufe über eine ausschließlich lokale Testbrücke an den Demo-Server weitergereicht. Das ist kein vollständiger End-to-End-Nachweis für das normale Laden der Seite, CSP-Verhalten oder den Netzwerkzugriff eines echten Handybrowsers. Die HTTP-Routen und Zugriffskontrollen wurden separat mit echten HTTP-Anfragen getestet. Die Testbrücke ist nicht Bestandteil des ausgelieferten Frontends.

## Noch am echten Gerät zu prüfen

Die Erreichbarkeit im Heimnetz, das Discovery-Verhalten der konkreten Firmware, die lokale WiZ-Sicherheitseinstellung, tatsächliche Farb-/Temperatur-/Dimmgrenzen und Paketverluste im WLAN bleiben vor Ort zu prüfen. Auch die automatische Wiedererkennung nach einer echten DHCP-Änderung sowie längerer Mehrbenutzerbetrieb wurden nicht auf Hardware getestet.

Der Prototyp ist kein Sicherheits-Audit und keine produktiv gehärtete, öffentlich betreibbare Smart-Home-Zentrale. „Nur verifizierte Steuerungen“, allgemeines WLAN-Pairing für beliebige Modelle, native WiZ-Effekte, Mehrzonen-Steuerung und Cloud-Anbindung gehören nicht zum implementierten Umfang.

## Experimentelle WLAN-Ersteinrichtung

Zusätzliche Tests prüfen UTF-8-Grenzen, Passwortgrenzen, zufällige IVs, vollständige Verschlüsselung der Zugangsdaten, Netz-/Firmware-/MAC-Prüfung sowie fehlende Wiederholung nach Timeout und Abschluss erst nach WLAN-Bestätigung. Inzwischen wurden WLAN-Beitritt, Abschluss und getPilot/getSystemConfig/getModelConfig im Heimnetz am ESP03_SHRGB1C_01 mit Firmware 1.32.0 bestätigt. Die Lampe ist gespeichert. Ein Stromausfalltest steht aus. Insgesamt bestehen 20 Tests. Siehe SETUP.md.

## Musikfunktion

- `npm test`: 26 bestandene Tests, einschließlich Pegelvalidierung, Weißlampen, fehlender Befehlswarteschlange, Wiederherstellung, Verbindungsablauf, Startabbruch und Musik-API-Konflikten.
- Chrome unter Linux mit lokalem Demo-Server: echte MP3-Decodierung und Web-Audio-Analyse, Lichtpakete, Wiederherstellung bei Pause, mobile Breite 390 px und keine JavaScript-Fehler geprüft.
- Native Linux-Ausgabeerfassung mit `parec` geprüft: 24 Pegelfenster in 2,5 Sekunden, kein Prozessfehler. Keine Audiodaten gespeichert.
- Zusätzlicher Test an der echten Lampe wurde wegen einer bereits aktiven Musiksitzung korrekt abgelehnt; keine Test-Lichtbefehle gesendet. Eine subjektive Beurteilung der Synchronität mit echter Musik steht aus.
- Browser-Tab-Freigabe hängt vom Browserdialog und Betriebssystem ab und wurde nicht mit einer interaktiven Freigabe getestet.

## Erweiterte Farben und Disco

- 33 automatisierte Tests bestanden. Neu geprüft: Reglergrenzen, mehr als 65 unterschiedliche monotone Helligkeitsstufen in einem definierten Pegeldurchlauf, Helligkeitskurven, zeitbasierte Glättung, Disco-Impulse gegenüber Dauertönen und Stille, Palettenfarben, Tempo, Sättigung und schwarze Wunschfarben.
- Chrome mit Demo-Lampe und echter MP3: Disco, eigene Farben, Mindesthelligkeit und Glättung während der Wiedergabe geändert und serverseitig bestätigt; Pause stellt das Licht wieder her. Mobile Breite und JavaScript-Fehler geprüft.
- Die sichtbare Wirkung der neuen Effekte an der echten Lampe wurde nicht bewertet. Maximale Übertragungsrate bleibt acht Befehle pro Sekunde.

## Kontinuierliche Audioanalyse

- 39 automatisierte Tests bestanden. Zusätzliche Audiosignale prüfen 50 Messfenster/Sekunde, Trennung von 80 Hz und 2 kHz bei drei Abtastraten, gegenphasiges Stereo, Stille/Rauschgrenze, kurze Bassimpulse, adaptive Pegeldynamik und Protokollvalidierung.
- Chrome mit Demo-Lampe und MP3 aus 70-ms-Bassstößen: Audio- und Bassbalken schwanken jeweils um mehr als 35 Prozentpunkte; mehrere Impulse erreichen die Sitzung. Live-Regler, Pause/Wiederherstellung und mobile Breite ebenfalls bestanden, keine JavaScript-Fehler.
- Linux-Ausgabeerfassung: 72 Messfenster in 1,5 Sekunden, kein Prozessfehler. Audio wurde nicht gespeichert. Die sichtbare Reaktion der echten Lampe auf die überarbeitete Analyse wurde nicht bewertet.

## Rhythmus und Disco-Akzente

- 43 Tests bestanden: Tempo und Beatanzahl bei 90/120/150 BPM, Offbeat-Unterdrückung nach Rhythmuserkennung, Rücksetzen bei Stille, Kick mit zusätzlichen Hi-Hats sowie klarer Disco-Akzent trotz anhaltend hoher Audioenergie.
- Chrome/MP3: 120 BPM mit stabiler Erkennung im Browser und in der Serversitzung bestätigt, Pegelvariation, Live-Farben und Wiederherstellung beim Stoppen geprüft.
- Diese Rhythmustests verwenden synthetische Audiosignale. Eine Bewertung mit dem konkreten Musikstück des Nutzers und Messung der tatsächlichen Lichtverzögerung an der Lampe steht aus. Es wird keine samplegenaue Synchronität zugesichert.

## UDP-Stabilität und Wiederherstellung

- 46 Tests bestanden. Abgesichert: gekennzeichneter Statuscache ohne konkurrierenden Lampenzugriff während Musik, gesperrte Suche, Unterdrückung identischer Lichtpakete, Sendepausen nach Fehlern und Wiederherstellung ohne ungültiges `sceneId: 0` oder gemischte Farbmodi.
- Reale Diagnose: Lampen-IP 192.168.178.53 antwortet weder auf getPilot noch Ping; Nachbartabelle meldet FAILED, lokale WiZ-Suche findet keine Lampe. Kein WiZ-Einrichtungsnetz im WLAN-Scan gesehen. Dies belegt keine bestimmte Ursache des Verbindungsverlusts; Betrieb an der echten Lampe bleibt bis zur Wiederverbindung ungeprüft.

## Prüfung beim Seitenaufruf

- 50 Tests bestanden, darunter zusammengefasste Startprüfungen, MAC-basierter IP-Wechsel mit Namenserhalt, Abweisung fremder Geräte an einer alten Adresse, Setup-Netzerkennung und Begrenzung wiederholter Suchen.
- Echte Lampe: neuer `/api/connection`-Endpunkt bestätigt `ready`, IP 192.168.178.53 und `online: true`.
- Chrome: automatische Suche auf leerer Hauptseite, Freigabe nach Verbindungsbestätigung, gesperrte Musiksteuerung bei unerreichbarer Lampe; keine JavaScript-Fehler. MP3/Beat-Browsertest mit vorgeschalteter Verbindungsprüfung ebenfalls bestanden.

## Vorbereitete MP3-Lichtshow

- 55 Tests bestanden. Abgesichert: deterministische Show aus dem ganzen Pegelverlauf, ruhige/intensive Abschnitte, Helligkeitsgrenzen, Positionswahl bei Sprüngen, Stille, validierte Show-Befehle, Weißlampen und Wiederherstellung bei ausbleibenden Daten.
- Chrome mit echter MP3-Decodierung und Demo-Lampe: vollständige Worker-Analyse vor Lampensitzung, Verlaufsvorschau, Show-Wiedergabe, Vorwärtssprung, Pause/Wiederherstellung, Rückwärtssprung/Fortsetzen, Live-Modus und mobile Breite. Keine JavaScript-Fehler.
- Die tatsächliche Lichtwirkung dieser neuen Show an der echten Lampe wurde nicht bewertet; Testmusik und Abschnittstests sind synthetisch.

## Browserspeicher, lange Vorschau und Klangfarben

- 58 Tests bestanden. Ergänzt: spektrale Unterscheidung gleich lauter Töne, Tonklasse über Oktaven, Stille, gegenphasiges Stereo sowie geglättete Farbänderung bei konstanter Lautstärke.
- Chrome: Effektregler, MP3-Modus, Vorlauf und Lautstärke über Neuladen erhalten; beschädigte gespeicherte Daten fallen auf Standardwerte zurück. Spektralmerkmale aus echter MP3-Decodierung bestätigt.
- Layout mit 500 Abschnitten und sehr langem Dateinamen: rechte Spalte unverändert und mindestens 300 px bei Desktopbreite; kein horizontaler Seitenüberlauf bei 1280 und 390 px.

## Zusammenhängende Farbfamilien

- 61 Tests bestanden. Neu: ähnliche wiederkehrende Klangabschnitte behalten dieselbe Farbfamilie, unveränderter Klang wandert nicht durch den Farbkreis, Live-Disco erhält acht einzelne Beat-Akzente pro Farbfamilie mit anschließendem weichem Wechsel.
- Browser: Vorab-Show mit MP3, Positionswechsel, Pause/Fortsetzen und Live-Fallback bestanden. Live-Beat-Test mit 120 BPM ebenfalls bestanden.
- Subjektive Abstimmung mit dem konkreten Lied bzw. der vom Nutzer beanstandeten Passage ist noch offen; synthetische Tests belegen Timing und Regeln, nicht die gestalterische Qualität für jedes Musikstück.

## Prüfung mit RobbieWilliamsBoddies.mp3

- Bereitgestellte Originaldatei vollständig lokal decodiert und analysiert: 263,697 Sekunden. Zuvor 36 Abschnitte mit zahlreichen Zwei-Sekunden-Wechseln; nach Stabilisierung der Abschnittsauswahl 21 Abschnitte im ffmpeg-Lauf bzw. 22 im Browser-Decoder. Keine dateinamenspezifischen Sonderregeln im Algorithmus.
- Helligkeit/Farben getrennt: 507 erkannte Beatereignisse ergeben im Browser 507 Bilder mit maximaler eingestellter Helligkeit. Grundhelligkeit entsteht nicht durch Dauerton oder durchschnittlichen Pegel.
- 66 Tests bestanden. Neue Prüfungen für identische Helligkeit bei gleichen Beats trotz anderer Lautstärke/Tonhöhe, unveränderte Beat-Helligkeit bei Farbglättung, lauten Dauerton ohne Beat und Tonhöhenverlauf über stärkerem Bass.
- Chrome mit dieser tatsächlichen MP3 und Demo-Lampe: vollständige Voranalyse, Sprünge zu 1:10, 3:06, 3:28 und 4:10, Pause/Wiederherstellung, Zurückspringen/Fortsetzen und Live-Fallback bestanden.
- Interaktive Vorschau der vorberechneten Lampenbefehle: reports/RobbieWilliamsBoddies-lichtverlauf.html. Es ist keine Audioaufnahme oder gemessene Helligkeit der realen Lampe enthalten. Die subjektive Wahrnehmung am echten Leuchtmittel bleibt vor Ort zu beurteilen.

## Erweiterte Soundmerkmale

- 71 Tests bestanden. Ergänzt: normierte fünf Frequenzbereiche, Ton/Rauschen-Unterscheidung, Mehrklangprofile, spektrale Veränderung und unveränderte Beat-Helligkeit trotz anderer Klangtextur und Frequenzverteilung.
- RobbieWilliamsBoddies.mp3 im Chrome-Browser vollständig analysiert: 263,697 Sekunden, 23 Abschnitte, 507 erkannte Beats und weiterhin 507 maximale Helligkeitsakzente. Sprünge, Pause/Fortsetzen und Live-Fallback bestanden.
- Die interaktive Lichtverlaufs-Vorschau wurde mit den neuen Soundmerkmalen neu erzeugt. Der Browser-/Demo-Test ersetzt keine subjektive Bewertung an der echten Lampe.

Klangfarben V2: Mit den vollständig extrahierten Merkmalen von
`RobbieWilliamsBoddies.mp3` die bisherige und neue Farbzuordnung bei identischen
Einstellungen verglichen (`reports/klangfarben-v2-vergleich.json`). Alle
Helligkeitsbilder sind unverändert; 507 Beats. Die Standardpalette erreicht nun
auch Violett, die mediane berechnete Sättigung steigt von ca. 60 auf 95 Prozent.
Browserprüfung mit vollständigem MP3-Decode und Worker: V2-Anzeige, Farbvorschau,
Show-Ausgabe, Zeitsprünge, Pause/Wiederherstellung, erneuter Start, Live-Wechsel
und mobiles Layout. Das prüft die erzeugten Befehle, nicht die Farbwiedergabe im
Raum. Regressionstest für Palettenumfang und Sättigung in `show-plan.test.mjs`.

Live-Spektrum: `test/live-analysis.test.mjs` prüft gegenphasiges Stereo bei
16/48 kHz, Trennung von Mitten und Höhen, unveränderte Beat- und Pegelfolgen
gegenüber dem bisherigen Analyzer, API-Grenzen und unterschiedliche Discofarben
bei gleicher Beat-Helligkeit. Gesamtsuite: 75 Tests bestanden. Browserlauf mit
RobbieWilliamsBoddies.mp3 einschließlich Worker-Vorabshow, Live-AudioWorklet,
Klangbild und Empfang von fünf Frequenzanteilen und Tonmerkmalen über die echte
lokale HTTP-API des Demo-Servers erfolgreich. Physische Lampenwirkung wurde
dabei nicht gemessen.

Klangfarben V3 / Melodiespur: 80 Tests bestanden. Neue Fälle prüfen den Verlauf
unter stärkerer zweiter Harmonischer, Steigen/Halten/Fallen, Pausen, transponierte
Motivwiederholungen, Unsicherheit und isolierte Tonspitzen. Die Beat-Helligkeit
wird mit der gleichen Analyse ohne Melodiespur auf identische Bilder geprüft.
Vollständiger Browserlauf mit RobbieWilliamsBoddies.mp3: 263,697 s, 507 Beats und
507 maximale Beat-Bilder, 47,0 % nutzbare Tonspur, 586 Tonsegmente, 64 mögliche
Phrasen und vier wiederkehrende Motivgruppen. Die Abdeckung ist kein Maß für
musikalische Erkennungsgenauigkeit. Wiedergabe, Springen, Pause/Wiederherstellung,
Live-Rückwechsel und mobiles Layout bestanden. Das neue Modul wird vom laufenden
Server auf Port 3030 ausgeliefert. Subjektive Übereinstimmung mit der führenden
Melodie und physische Lampenwirkung wurden nicht als validiert gewertet.

Laufende Show einstellen: Browserprüfung mit vollständiger Robbie-MP3 und lokalem
Demo-Server. Alle wirksamen Effektregler sind während der Show bedienbar. Palette
auf Ozean, Sättigung auf 55 %, Maximum auf 45 % und Glättung auf 70 % während
laufender Musik geändert; neue RGB-Bilder und Helligkeitsgrenzen kontrolliert.
Sitzungs-ID unverändert, Player bleibt unpausiert und seine Zeit läuft weiter.
Anschließend ursprüngliche Einstellungen wieder eingesetzt und Zeitsprünge,
Pause/Wiederherstellung, erneuter Start, Live-Wechsel und mobiles Layout geprüft.

Klangfarben V4: 82 Tests bestanden. Regressionen prüfen sichtbare Farbänderungen
bei hörbarem Klangwechsel trotz völlig unsicherer Melodie, unveränderte
Beat-Helligkeit, Führungswechsel nach längerer Unsicherheit, Überbrückung kurzer
Lücken und Halten bei Stille. Vollständiger MP3-Browserlauf samt laufenden
Regleränderungen, Seek, Pause, Wiederherstellung, Live-Rückwechsel und mobilem
Layout bestanden. Robbie-MP3: 507 Beats und 507 maximale Beat-Bilder unverändert;
2110 Bilder, davon 750 melodiegeführt, 1120 gemischt, 224 spektral und 16 Pause.
Diese Messung belegt die aktive Mischung, nicht eine subjektiv bessere Wirkung
an der physischen Lampe.

Stimmungsmodus V5: 87 Tests bestanden. Tests decken Dur/Moll-Profilvergleich,
Ablehnung unklarer/stiller Verteilungen, Energiedifferenzierung bei gleicher
Tonart, Halten bei Unsicherheit, weiche Palettenübergänge und identische
Beat-Helligkeit mit/ohne Modus ab. Browserprüfung mit vollständiger Robbie-MP3:
Modus aktivieren, während Wiedergabe aus-/einschalten (gleiche Sitzung), weitere
Regler ändern, springen, pausieren/wiederherstellen, Live-Rückwechsel, mobiles
Layout und gespeicherte Auswahl nach Reload. 507 Beat-Akzente unverändert.
132 Zwei-Sekunden-Bewertungen: 6 neutral, 6 warm/gelöst, 40 ruhig/melancholisch,
80 kraftvoll/gespannt. Dies sind heuristische Zuordnungen, keine validierten
Emotionslabels der Aufnahme. Laufender Server liefert mood-analysis.js aus.

Wiederverbindung nach Stromausfall: 89 Tests bestanden. Neue HTTP-Regressionen
prüfen frische manuelle Statusprüfung trotz Fehlercache und direkte Prüfung
bekannter IPs bei ausbleibenden Broadcast-Antworten. Browser-Simulation mit
Entfernen der Lampe und Wiederkehr unter neuer DHCP-IP: automatische Erkennung,
Erhalt des Namens, erneute Freigabe der Steuerung, keine Browserfehler. Physische
Statusprüfung: Heimnetz-IP 192.168.178.53 ohne Antwort; frischer WLAN-Scan
bestätigt WiZConfig_d27c. Kein tatsächlicher Stromzyklus durchgeführt und keine
WLAN-Zugangsdaten verändert.

Automatische WLAN-Wiederherstellung: 96 Tests bestanden. Neue Tests prüfen
MAC-Verifikation vor Zugangsdatenübertragung, private Dateirechte, Bereinigung
des temporären AP-Profils, Schutz vor Doppelaufträgen und Wiederholung unklarer
Übertragungen, genau einen Wiederholungsversuch nach bestätigtem aber
wirkungslosen Auftrag sowie Abschluss eines schon im Heimnetz erreichbaren
Einrichtungsversuchs vor Löschen des Journals. An der echten Lampe wurde die
Verbindung über WiZConfig_d27c und die Wiederherstellung unter 192.168.178.53
bestätigt. WLAN-Daten separat erfolgreich mit temporärem NM-Profil geprüft;
keine Zugangsdaten ausgegeben. Temporäre Profile entfernt, Automatik aktiviert.
Ein erneuter physischer Aus-/Einschaltzyklus wurde nicht durchgeführt.

Lichtshow-Editor: 100 Tests bestanden. Neue Tests für RGB-/Kelvin-Interpolation,
harte Übergänge, begrenzte/validierte Projekte, Beat-Helligkeit, lampenspezifische
Ausgabe und tatsächlichen Transport von Weißtemperatur samt Wiederherstellung.
Browserprüfung mit kompletter Robbie-MP3: Punkte erstellen/färben, Wiedergabe,
Farbänderung während derselben Sitzung, Stop/Wiederherstellung, getrennte Entwürfe
für zwei Lampen, Reload/Wiederöffnen, Löschen/Rückgängig und Layout bei 390 px.
Mobile Ansicht zusätzlich per Screenshot geprüft. Hardware-Lichtwiedergabe wurde
nicht ausgelöst; Transportprüfung verwendet Demo-Lampen.

Editor-Bedienung überarbeitet: 108 Tests der bestehenden Suite bestanden.
Zusätzlicher Playwright-Browserlauf mit echter Robbie-MP3 und echten
Maus-/Tastaturereignissen: Punkt per Doppelklick, Ziehen, 4× Zoom, Pfeil-Nudging,
Strg+Z/Strg+Umschalt+Z, Leertaste, N, Duplizieren/Löschen, Eingabefeld-Isolation,
Schutz des festen Startpunkts, Lichtwiedergabe/Restore, Entwurf nach Reload und
kein Seitenüberlauf bei 390 px und 16× Zoom. Desktop-/Mobil-Screenshots erstellt,
Desktop-Ansicht visuell geprüft. Bestehende Beat-This!-Integration beibehalten;
der Interaktionstest nutzt für reproduzierbare Laufzeit die Standard-Analyse.
