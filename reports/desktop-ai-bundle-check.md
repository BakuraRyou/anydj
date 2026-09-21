# Vollständiges Linux-KI-Paket — 2026-09-20

- Drei eigenständige PyInstaller-Programme mit eingebautem CPython: Beat This!, Discogs-EffNet und All-In-One/Demucs.
- Modellgewichte im Paket; beschreibbare Analyse-Caches im Benutzerprofil.
- `npm run pack:analysis`, danach `npm run pack -- --linux`.
- Vollbuild ohne KI-Paket bricht ab; `--lite` ist ausdrücklich eine Basisversion.

## Prüfung

1. 60 Sekunden aus RobbieWilliamsBoddies.mp3: Ausführung in einem temporären Arbeitsverzeichnis mit leerem PATH sowie ungültigen PYTHONHOME/PYTHONPATH. Kein Zugriff auf eine installierte Python-Laufzeit nötig. Beat-Erkennung 3,3 s (125 Beats), Stil 0,7 s (30 Segmente), Struktur/Instrumente 36,3 s (5 Segmente, Instrumentdaten vorhanden).
2. Vollständiger Song in der gepackten Desktop-App, frisches Profil und isolierter Demo-Port: **✓ Vollständig berechnet**, 121,4 Sekunden. Alle drei Analyse-Endpunkte melden verfügbar. Der vorhandene Song-Zeitbudgetschutz blieb unverändert aktiv.
3. Die fertige AppImage startet im integrierten Entpackmodus, zeigt beide Decks und meldet alle KI-Komponenten verfügbar. Der direkte Mount-Start scheiterte im Test mit `open dir error: No such file or directory`; hierfür keine erfolgreiche FUSE-Startprüfung behauptet. Entpackmodus: `APPIMAGE_EXTRACT_AND_RUN=1 ./AnyDj-0.1.0-linux-x86_64.AppImage`.
4. Vorhandene Testsuite: 208 Tests bestanden. Zwei zusätzliche Tests prüfen die Ablehnung unpassender bzw. unvollständiger KI-Pakete; beide bestanden.
5. Debian-Paket erfolgreich gebaut, Paket-Metadaten geprüft; keine systemweite Testinstallation vorgenommen.

## Artefakte und Grenzen

- `dist/AnyDj-0.1.0-linux-x86_64.AppImage`: ca. 786 MiB.
- `dist/AnyDj-0.1.0-linux-amd64.deb`: ca. 820 MiB.
- KI-Verzeichnis unkomprimiert ca. 2,3 GiB, zusätzlich Electron.
- Lokaler Linux-x64-Build auf glibc 2.43; `.deb` verlangt konservativ libc6 >= 2.43. Für ältere Distributionen auf einer passenden älteren Build-Basis neu erstellen. Kein Test auf einem frischen Fremdsystem.
- Vollständiges Windows-KI-Paket noch nicht gebaut/validiert. Der manuelle Windows-CI-Workflow erzeugt ausdrücklich nur die Basisversion.
- Vor dem Start der neuen Version die bereits geöffnete alte App schließen. Bereits gespeicherte Teilanalysen einmal mit „Lichtshow neu berechnen“ aktualisieren.
