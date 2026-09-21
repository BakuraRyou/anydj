#!/usr/bin/env python3
"""FTP/explicit FTPS deployment. Credentials stay in the local JSON file."""
import argparse
import ftplib
import io
import json
import posixpath
import re
import ssl
import sys
import uuid
from pathlib import Path

RELEASE = re.compile(r"^\d{14}-[a-f0-9]{12}$")


def progress(message):
    # stdout is the JSON result consumed by deploy.mjs; stderr is streamed live.
    print(message, file=sys.stderr, flush=True)


def load_config(path):
    try:
        config = json.loads(Path(path).read_text())
    except (OSError, ValueError):
        raise ValueError("Deployment-Konfiguration fehlt oder enthält kein gültiges JSON.") from None
    if not isinstance(config, dict):
        raise ValueError("Deployment-Konfiguration muss ein JSON-Objekt sein.")
    for key in ("host", "username", "password", "localDir"):
        value = config.get(key)
        if not isinstance(value, str) or not value or any(c in value for c in "\r\n\0"):
            raise ValueError("Ungültiges oder fehlendes Konfigurationsfeld: " + key)
    target = config["localDir"]
    if not target.startswith("/") or any(p in (".", "..") for p in target.split("/")):
        raise ValueError("localDir muss ein absoluter FTP-Pfad ohne . oder .. sein; / ist für eingeschränkte FTP-Zugänge erlaubt.")
    config["localDir"] = "/" + "/".join(part for part in target.split("/") if part)
    try:
        config["port"] = int(config.get("port", 21))
        if not 1 <= config["port"] <= 65535:
            raise ValueError()
    except (ValueError, TypeError):
        raise ValueError("Ungültiger FTP-Port.") from None
    if not isinstance(config.get("secure", True), bool):
        raise ValueError("secure muss true oder false sein.")
    if config.get("tlsServername") and not re.fullmatch(r"[A-Za-z0-9.-]+", str(config["tlsServername"])):
        raise ValueError("Ungültiger TLS-Servername.")
    return config


def read_json(ftp, path, optional=False):
    output = bytearray()

    def chunk(data):
        output.extend(data)
        if len(output) > 8192:
            raise ValueError("Remote-Manifest zu groß.")

    try:
        ftp.retrbinary("RETR " + path, chunk)
    except ftplib.error_perm as error:
        if optional and str(error).startswith("550"):
            return None
        raise
    try:
        value = json.loads(output)
        if not isinstance(value, dict) or not RELEASE.fullmatch(value.get("release", "")):
            raise ValueError()
        return value
    except (ValueError, TypeError):
        raise ValueError("Ungültiges Remote-Manifest. Bestehende Dateien bleiben unangetastet.") from None


def mkdirs(ftp, path, known=None):
    current = "/"
    for part in path.split("/"):
        if not part:
            continue
        current = posixpath.join(current, part)
        if known is not None and current in known:
            continue
        try:
            ftp.mkd(current)
        except ftplib.error_perm:
            ftp.cwd(current)  # Distinguish an existing directory from denied access.
        if known is not None:
            known.add(current)


def atomic_write(ftp, path, data):
    temporary = path + ".upload-" + uuid.uuid4().hex
    ftp.storbinary("STOR " + temporary, io.BytesIO(data))
    try:
        # FTP RNTO must replace atomically; never delete the live destination first.
        ftp.rename(temporary, path)
    except Exception:
        try:
            ftp.delete(temporary)
        except ftplib.all_errors:
            pass
        raise


def remote_files(ftp, root):
    """List regular files only; never follow links or server-supplied traversal."""
    files = []
    for name, facts in ftp.mlsd(root):
        kind = facts.get("type", "")
        if kind in ("cdir", "pdir"):
            continue
        if not name or name in (".", "..") or any(c in name for c in "/\\\r\n\0"):
            raise ValueError("Unsicherer Dateiname in FTP-Verzeichnis. Vorgang abgebrochen.")
        if kind == "dir":
            files.extend(posixpath.join(name, child) for child in remote_files(ftp, posixpath.join(root, name)))
        elif kind == "file":
            files.append(name)
        else:
            raise ValueError("FTP-Verzeichnis enthält Symlinks oder unbekannte Dateitypen. Vorgang abgebrochen.")
    return sorted(files)


def download(ftp, path):
    data = io.BytesIO()
    ftp.retrbinary("RETR " + path, data.write)
    return data.getvalue()


def remove_tree(ftp, root):
    # Validate the entire tree before removing anything; only called for owned
    # release/staging directories, never for the live public directory.
    files = remote_files(ftp, root)
    for name in files:
        ftp.delete(posixpath.join(root, name))
    def remove_dirs(path):
        for name, facts in list(ftp.mlsd(path)):
            if facts.get("type") == "dir":
                remove_dirs(posixpath.join(path, name))
        ftp.rmd(path)
    remove_dirs(root)


def stage_public(ftp, target, manifest, current, bundle=None):
    public = posixpath.join(target, "public")
    archive = posixpath.join(target, "releases", manifest["release"], "public")
    names = remote_files(ftp, archive)
    if "index.html" not in names:
        raise ValueError("Release enthält keine public/index.html.")
    old_names = set(remote_files(ftp, posixpath.join(target, "releases", current["release"], "public"))) if current else set()
    existing = remote_files(ftp, public)
    staging = posixpath.join(target, "tmp", "public-stage-" + uuid.uuid4().hex)
    ftp.mkd(staging)
    known = {staging}
    parent = posixpath.dirname(staging)
    while parent != "/":
        known.add(parent)
        parent = posixpath.dirname(parent)
    try:
        # Keep unrelated hoster files (e.g. .htaccess/.well-known); remove only
        # stale files known to belong to the previously active release.
        for name in existing:
            if name not in old_names and name not in names:
                path = posixpath.join(staging, name)
                mkdirs(ftp, posixpath.dirname(path), known)
                atomic_write(ftp, path, download(ftp, posixpath.join(public, name)))
        progress(f"Plesk public/: {len(names)} Webdateien bereitstellen …")
        for index, name in enumerate(names, 1):
            progress(f"[public {index}/{len(names)}] {name}")
            data = (bundle / "public" / name).read_bytes() if bundle else download(ftp, posixpath.join(archive, name))
            path = posixpath.join(staging, name)
            mkdirs(ftp, posixpath.dirname(path), known)
            atomic_write(ftp, path, data)
        return staging
    except Exception:
        remove_tree(ftp, staging)
        raise


def activate(ftp, target, manifest, current, bundle=None):
    previous = read_json(ftp, posixpath.join(target, "previous.json"), optional=True)
    staging = stage_public(ftp, target, manifest, current, bundle)
    public = posixpath.join(target, "public")
    backup = posixpath.join(target, "tmp", "public-backup-" + uuid.uuid4().hex)
    ftp.rename(public, backup)
    try:
        ftp.rename(staging, public)
    except Exception:
        ftp.rename(backup, public)
        remove_tree(ftp, staging)
        raise
    previous_written = False
    try:
        if current:
            atomic_write(ftp, posixpath.join(target, "previous.json"), json.dumps(current).encode())
            previous_written = True
        atomic_write(ftp, posixpath.join(target, "current.json"), json.dumps(manifest).encode())
    except Exception:
        ftp.rename(public, staging)
        ftp.rename(backup, public)
        remove_tree(ftp, staging)
        if previous_written and previous:
            atomic_write(ftp, posixpath.join(target, "previous.json"), json.dumps(previous).encode())
        elif previous_written:
            ftp.delete(posixpath.join(target, "previous.json"))
        raise
    remove_tree(ftp, backup)


def prune_releases(ftp, target, current, expected_release):
    if not current or current["release"] != expected_release:
        raise ValueError("Bereinigung abgebrochen: Aktives Release hat sich seit dem Healthcheck geändert.")
    previous = read_json(ftp, posixpath.join(target, "previous.json"), optional=True)
    releases = posixpath.join(target, "releases")
    names = {name for name, facts in ftp.mlsd(releases) if facts.get("type") == "dir" and RELEASE.fullmatch(name)}
    complete = set()
    for name in names:
        contents = remote_files(ftp, posixpath.join(releases, name))
        if "server.mjs" in contents and "public/index.html" in contents:
            complete.add(name)
    keep = {current["release"]}
    if previous:
        keep.add(previous["release"])
    if not keep.issubset(complete):
        raise ValueError("Bereinigung abgebrochen: Aktives oder vorheriges Release fehlt oder ist unvollständig.")
    for name in sorted(complete - keep, reverse=True):
        if len(keep) >= 3:
            break
        keep.add(name)
    removed = []
    for name in sorted(names - keep):
        path = posixpath.join(releases, name)
        progress("Altes Release entfernen: " + name)
        remove_tree(ftp, path)
        removed.append(name)
    return {"action": "prune", "release": current["release"], "kept": sorted(keep), "removed": removed}


def plan_bundle(bundle):
    manifest = json.loads((bundle / "current.json").read_text())
    release = manifest.get("release", "")
    if not RELEASE.fullmatch(release):
        raise ValueError("Ungültiges Build-Manifest.")
    files = sorted(path for path in bundle.rglob("*") if path.is_file())
    allowed = {"index.js", "package.json", "current.json"}
    for path in files:
        relative = path.relative_to(bundle).as_posix()
        if path.is_symlink() or any(part.startswith(".") for part in Path(relative).parts):
            raise ValueError("Versteckte Dateien oder Symlinks im Deployment-Paket.")
        if relative not in allowed and not relative.startswith(("releases/" + release + "/", "public/")):
            raise ValueError("Unerwartete Datei im Deployment-Paket.")
    for required in ("index.js", "package.json", "public/index.html", "releases/" + release + "/server.mjs", "releases/" + release + "/public/index.html"):
        if not (bundle / required).is_file():
            raise ValueError("Unvollständiges Hosting-Paket.")
    public_files = {p.relative_to(bundle / "public").as_posix(): p.read_bytes() for p in files if p.is_relative_to(bundle / "public")}
    archive_root = bundle / "releases" / release / "public"
    archived_files = {p.relative_to(archive_root).as_posix(): p.read_bytes() for p in files if p.is_relative_to(archive_root)}
    if public_files != archived_files:
        raise ValueError("public/ und Release-Sicherung stimmen nicht überein.")
    return manifest, files


def deploy(ftp, config, action, bundle=None, expected_release=None):
    target = config["localDir"]
    directories = set()
    ensure_dir = lambda path: mkdirs(ftp, path, directories)
    if action == "check":
        exists = True
        try:
            ftp.cwd(target)
        except ftplib.error_perm:
            exists = False
        # Exercise the protected data connection as well, without disclosing names.
        ftp.retrlines("LIST", lambda line: None)
        return {"action": action, "targetExists": exists, "tls": config.get("secure", True)}
    if action == "deploy":
        manifest, files = plan_bundle(bundle)
        progress("Zielverzeichnisse vorbereiten …")
        ensure_dir(target)
        ensure_dir(posixpath.join(target, "tmp"))
        ensure_dir(posixpath.join(target, "public"))
    else:
        ftp.cwd(target)
        ensure_dir(posixpath.join(target, "tmp"))
    lock = posixpath.join(target, "tmp/deploy.lock")
    try:
        ftp.mkd(lock)
    except ftplib.error_perm:
        raise ValueError("Deployment gesperrt: anderer Deploy aktiv oder tmp/deploy.lock nach Abbruch noch vorhanden.") from None
    try:
        current = read_json(ftp, posixpath.join(target, "current.json"), optional=True)
        if action == "prune":
            return prune_releases(ftp, target, current, expected_release)
        if action == "deploy":
            release_dir = posixpath.join(target, "releases", manifest["release"])
            ensure_dir(posixpath.join(target, "releases"))
            ftp.mkd(release_dir)  # Releases are immutable; never reuse a directory.
            directories.add(release_dir)
            uploads = [path for path in files if path.relative_to(bundle).as_posix().startswith("releases/")]
            total_bytes = sum(path.stat().st_size for path in uploads)
            progress(f"Upload: {len(uploads)} Dateien · {total_bytes / 1024:.0f} KiB")
            for index, path in enumerate(uploads, 1):
                relative = path.relative_to(bundle).as_posix()
                progress(f"[{index}/{len(uploads)}] {path.relative_to(bundle / 'releases' / manifest['release']).as_posix()}")
                destination = posixpath.join(target, relative)
                ensure_dir(posixpath.dirname(destination))
                atomic_write(ftp, destination, path.read_bytes())
            # Stable CommonJS bootstrap; no runtime dependencies or secrets.
            progress("Upload vollständig. Startdateien übertragen und Release aktivieren …")
            for name in ("package.json", "index.js"):
                atomic_write(ftp, posixpath.join(target, name), (bundle / name).read_bytes())
            activate(ftp, target, manifest, current, bundle)
        elif action == "rollback":
            manifest = read_json(ftp, posixpath.join(target, "previous.json"))
            ftp.cwd(posixpath.join(target, "releases", manifest["release"], "public"))
            ensure_dir(posixpath.join(target, "public"))
            activate(ftp, target, manifest, current)
        else:
            if not current:
                raise ValueError("Noch kein AnyDj-Release vorhanden. Zuerst deployen.")
            manifest = current
        marker = "anydj-crash-restart" if action == "crash" else "restart.txt"
        progress("Crash-Neustart anfordern …" if action == "crash" else "Passenger-Neustart anfordern …")
        atomic_write(ftp, posixpath.join(target, "tmp", marker), uuid.uuid4().hex.encode())
        return {"action": action, "release": manifest["release"], "previous": current and current["release"]}
    finally:
        ftp.rmd(lock)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True)
    parser.add_argument("--action", choices=("check", "deploy", "restart", "crash", "rollback", "prune"), required=True)
    parser.add_argument("--expected-release")
    parser.add_argument("--bundle", type=Path)
    args = parser.parse_args()
    config = load_config(args.config)
    if args.action == "deploy":
        plan_bundle(args.bundle)
    ftp = ftplib.FTP_TLS(context=ssl.create_default_context()) if config.get("secure", True) else ftplib.FTP()
    try:
        progress("FTP-Verbindung herstellen …")
        ftp.connect(config["host"], config["port"], timeout=30)
        if config.get("secure", True) and config.get("tlsServername"):
            # Keep the configured destination IP; verify certificate/SNI against
            # the explicitly configured DNS identity, on control and data sockets.
            ftp.host = config["tlsServername"]
        progress("FTP-Anmeldung …")
        ftp.login(config["username"], config["password"])
        if config.get("secure", True):
            ftp.prot_p()
        ftp.set_pasv(True)
        progress("FTP verbunden.")
        result = deploy(ftp, config, args.action, args.bundle, args.expected_release)
        print(json.dumps(result))
    finally:
        ftp.close()


if __name__ == "__main__":
    try:
        main()
    except ssl.SSLCertVerificationError:
        print("FTPS-Zertifikat ungültig: in host den zum Zertifikat passenden FTP-Hostnamen verwenden.", file=sys.stderr)
        sys.exit(1)
    except ValueError as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
    except Exception as error:
        # Server replies may contain account details; never dump credentials or tracebacks.
        print("Deployment fehlgeschlagen (" + type(error).__name__ + "). Verbindung, FTP-Rechte und Zielpfad prüfen. Keine Zugangsdaten ausgegeben.", file=sys.stderr)
        sys.exit(1)
