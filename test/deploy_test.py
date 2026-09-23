import ftplib
import importlib.util
import io
import json
import tempfile
import unittest
from contextlib import redirect_stderr
from pathlib import Path

spec = importlib.util.spec_from_file_location('deploy', Path(__file__).parents[1] / 'builder/ftp/deploy.py')
deploy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(deploy)
OLD = '20260101000000-aaaaaaaaaaaa'
NEW = '20260201000000-bbbbbbbbbbbb'
OLD_PAGE = b'<header>old logo</header><div class="download-grid"><article><div>size and hash</div><a href="./downloads/AnyDj-old.exe">Download</a></article></div><footer>old footer</footer>'
TEMPLATE = '<header>new logo</header><div class="download-grid">no downloads yet</div><footer>legal links</footer>'
UPDATED_PAGE = OLD_PAGE.replace(b'old logo', b'new logo').replace(b'old footer', b'legal links')


class FakeFTP:
    def __init__(self):
        self.dirs = {'/', '/anydj.de', '/anydj.de/tmp', '/anydj.de/public', '/anydj.de/releases', '/anydj.de/releases/' + OLD, '/anydj.de/releases/' + OLD + '/public'}
        self.files = {'/anydj.de/current.json': json.dumps({'release': OLD}).encode(), '/anydj.de/unrelated.txt': b'keep',
                      '/anydj.de/releases/' + OLD + '/public/index.html': b'old homepage',
                      '/anydj.de/releases/' + OLD + '/server.mjs': b'old server',
                      '/anydj.de/public/index.html': b'old homepage'}
        self.fail_suffix = None
        self.fail_public_swap = False
        self.events = []
        self.transfers = []
        self.mkdir_calls = []

    def mkd(self, path):
        self.mkdir_calls.append(path)
        if path in self.dirs:
            raise ftplib.error_perm('550 exists')
        self.dirs.add(path)

    def cwd(self, path):
        if path not in self.dirs:
            raise ftplib.error_perm('550 missing')

    def rmd(self, path):
        if any(name.startswith(path + '/') for name in self.files.keys() | self.dirs):
            raise ftplib.error_perm('550 not empty')
        self.dirs.remove(path)

    def mlsd(self, path):
        self.cwd(path)
        prefix = path.rstrip('/') + '/'
        entries = []
        for name in self.dirs | self.files.keys():
            if name.startswith(prefix):
                relative = name[len(prefix):]
                if relative and '/' not in relative:
                    entries.append((relative, {'type': 'dir' if name in self.dirs else 'file'}))
        return iter(sorted(entries))

    def storbinary(self, command, source):
        path = command[5:]
        self.transfers.append(command)
        if self.fail_suffix and self.fail_suffix in path:
            raise OSError('simulated upload failure')
        self.files[path] = source.read()

    def retrbinary(self, command, callback):
        path = command[5:]
        self.transfers.append(command)
        if path not in self.files:
            raise ftplib.error_perm('550 missing')
        callback(self.files[path])

    def rename(self, source, target):
        if self.fail_public_swap and '/public-stage-' in source and target.endswith('/public'):
            self.fail_public_swap = False
            raise ftplib.error_perm('550 simulated directory activation failure')
        if source in self.dirs:
            if target in self.dirs:
                raise ftplib.error_perm('550 exists')
            self.dirs = {target + name[len(source):] if name == source or name.startswith(source + '/') else name for name in self.dirs}
            self.files = {target + name[len(source):] if name.startswith(source + '/') else name: data for name, data in self.files.items()}
        else:
            self.files[target] = self.files.pop(source)
        self.events.append(target)

    def delete(self, path):
        del self.files[path]


class DeploymentTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.bundle = Path(self.tmp.name)
        for path, data in {'index.js': 'bootstrap', 'package.json': '{}', 'current.json': json.dumps({'release': NEW}), 'public/index.html': 'homepage', 'releases/' + NEW + '/server.mjs': 'server', 'releases/' + NEW + '/public/index.html': 'homepage'}.items():
            file = self.bundle / path
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_text(data)
        self.ftp = FakeFTP()
        self.config = {'localDir': '/anydj.de'}
        self.log = io.StringIO()
        output = redirect_stderr(self.log)
        output.__enter__()
        self.addCleanup(output.__exit__, None, None, None)

    def current(self):
        return json.loads(self.ftp.files['/anydj.de/current.json'])['release']

    def prepare_web_deploy(self):
        (self.bundle / 'current.json').write_text(json.dumps({'release': NEW, 'preserveDownloads': True}))
        for directory in ['public', 'releases/' + NEW + '/public']:
            (self.bundle / directory / 'downloads.html').write_text(TEMPLATE)
        self.ftp.dirs.add('/anydj.de/public/downloads')
        self.ftp.files['/anydj.de/public/downloads/AnyDj-old.exe'] = b'published installer'
        self.ftp.files['/anydj.de/public/downloads.html'] = OLD_PAGE

    def assert_downloads_preserved(self, page=OLD_PAGE):
        self.assertEqual(self.ftp.files['/anydj.de/public/downloads/AnyDj-old.exe'], b'published installer')
        self.assertEqual(self.ftp.files['/anydj.de/public/downloads.html'], page)
        self.assertFalse(any('AnyDj-old.exe' in command for command in self.ftp.transfers))
        self.assertFalse(any('public-backup-' in p or 'public-stage-' in p for p in self.ftp.dirs))

    def test_web_deploy_moves_installers_without_transfer(self):
        self.prepare_web_deploy()
        deploy.deploy(self.ftp, self.config, 'deploy', self.bundle)
        self.assertEqual(self.current(), NEW)
        self.assert_downloads_preserved(UPDATED_PAGE)

    def test_web_deploy_failures_restore_installers(self):
        for failure in ['swap', 'manifest', 'staging', 'download-move']:
            with self.subTest(failure=failure):
                self.ftp = FakeFTP()
                self.prepare_web_deploy()
                if failure == 'swap':
                    self.ftp.fail_public_swap = True
                elif failure == 'download-move':
                    rename = self.ftp.rename
                    def fail_move(source, target):
                        if '/public-backup-' in source and source.endswith('/downloads'):
                            raise ftplib.error_perm('550 simulated download move failure')
                        rename(source, target)
                    self.ftp.rename = fail_move
                else:
                    self.ftp.fail_suffix = '/current.json.upload-' if failure == 'manifest' else 'public-stage-'
                with self.assertRaises((OSError, ftplib.error_perm)):
                    deploy.deploy(self.ftp, self.config, 'deploy', self.bundle)
                self.assertEqual(self.current(), OLD)
                self.assert_downloads_preserved()

    def test_web_rollback_preserves_current_download_links_and_installers(self):
        self.prepare_web_deploy()
        # The previous website archive has no installers and an outdated page.
        self.ftp.files['/anydj.de/current.json'] = json.dumps({'release': OLD, 'preserveDownloads': True}).encode()
        self.ftp.files['/anydj.de/releases/' + OLD + '/public/downloads.html'] = b'outdated links'
        deploy.deploy(self.ftp, self.config, 'deploy', self.bundle)
        deploy.deploy(self.ftp, self.config, 'rollback')
        self.assertEqual(self.current(), OLD)
        self.assert_downloads_preserved(UPDATED_PAGE)

    def test_first_web_deploy_uses_placeholder(self):
        self.prepare_web_deploy()
        self.ftp.files.pop('/anydj.de/public/downloads/AnyDj-old.exe')
        self.ftp.files.pop('/anydj.de/public/downloads.html')
        self.ftp.dirs.remove('/anydj.de/public/downloads')
        self.ftp.files.pop('/anydj.de/current.json')
        deploy.deploy(self.ftp, self.config, 'deploy', self.bundle)
        self.assertEqual(self.ftp.files['/anydj.de/public/downloads.html'], TEMPLATE.encode())

    def test_invalid_download_page_leaves_live_release_untouched(self):
        for invalid in [b'no grid', b'<div class="download-grid">broken', b'<div class="download-grid"></div><div class="download-grid"></div>']:
            with self.subTest(invalid=invalid):
                self.ftp = FakeFTP()
                self.prepare_web_deploy()
                self.ftp.files['/anydj.de/public/downloads.html'] = invalid
                with self.assertRaisesRegex(ValueError, 'Downloadbereich'):
                    deploy.deploy(self.ftp, self.config, 'deploy', self.bundle)
                self.assertEqual(self.current(), OLD)
                self.assertEqual(self.ftp.files['/anydj.de/public/downloads.html'], invalid)
                self.assertEqual(self.ftp.files['/anydj.de/public/downloads/AnyDj-old.exe'], b'published installer')

    def test_web_bundle_rejects_accidental_installers_before_upload(self):
        self.prepare_web_deploy()
        directory = self.bundle / 'public/downloads'
        directory.mkdir()
        (directory / 'AnyDj.exe').write_bytes(b'installer')
        with self.assertRaisesRegex(ValueError, 'keine Installer'):
            deploy.deploy(self.ftp, self.config, 'deploy', self.bundle)
        self.assertEqual(self.ftp.transfers, [])

    def test_upload_activates_after_complete_release_and_preserves_other_files(self):
        deploy.deploy(self.ftp, self.config, 'deploy', self.bundle)
        self.assertEqual(self.current(), NEW)
        self.assertEqual(json.loads(self.ftp.files['/anydj.de/previous.json'])['release'], OLD)
        events = self.ftp.events
        self.assertLess(events.index('/anydj.de/releases/' + NEW + '/public/index.html'), events.index('/anydj.de/current.json'))
        self.assertLess(events.index('/anydj.de/current.json'), events.index('/anydj.de/tmp/restart.txt'))
        self.assertEqual(self.ftp.files['/anydj.de/unrelated.txt'], b'keep')
        self.assertNotIn('/anydj.de/tmp/deploy.lock', self.ftp.dirs)
        self.assertEqual(self.ftp.files['/anydj.de/public/index.html'], b'homepage')
        self.assertNotIn('/anydj.de/public/server.mjs', self.ftp.files)

    def test_interrupted_upload_keeps_active_release(self):
        self.ftp.fail_suffix = 'index.html'
        with self.assertRaises(OSError):
            deploy.deploy(self.ftp, self.config, 'deploy', self.bundle)
        self.assertEqual(self.current(), OLD)
        self.assertNotIn('/anydj.de/tmp/restart.txt', self.ftp.files)
        self.assertNotIn('/anydj.de/tmp/deploy.lock', self.ftp.dirs)
        self.assertNotIn('Upload vollständig', self.log.getvalue())

    def test_progress_is_live_and_release_directories_are_prepared_once(self):
        deploy.deploy(self.ftp, self.config, 'deploy', self.bundle)
        messages = self.log.getvalue()
        self.assertIn('[1/2] public/index.html', messages)
        self.assertIn('[2/2] server.mjs', messages)
        self.assertIn('Upload vollständig', messages)
        for directory in ['/anydj.de', '/anydj.de/releases', '/anydj.de/releases/' + NEW]:
            self.assertEqual(self.ftp.mkdir_calls.count(directory), 1, directory)

    def test_rollback_swaps_manifest_and_requests_restart(self):
        deploy.deploy(self.ftp, self.config, 'deploy', self.bundle)
        deploy.deploy(self.ftp, self.config, 'rollback')
        self.assertEqual(self.current(), OLD)
        self.assertEqual(json.loads(self.ftp.files['/anydj.de/previous.json'])['release'], NEW)
        self.assertEqual(self.ftp.files['/anydj.de/public/index.html'], b'old homepage')

    def test_public_staging_failure_keeps_old_files_and_active_manifest(self):
        self.ftp.fail_suffix = 'public-stage-'
        with self.assertRaises(OSError):
            deploy.deploy(self.ftp, self.config, 'deploy', self.bundle)
        self.assertEqual(self.current(), OLD)
        self.assertEqual(self.ftp.files['/anydj.de/public/index.html'], b'old homepage')

    def test_manifest_failure_restores_public_and_previous_pointer(self):
        self.ftp.fail_suffix = '/current.json.upload-'
        with self.assertRaises(OSError):
            deploy.deploy(self.ftp, self.config, 'deploy', self.bundle)
        self.assertEqual(self.current(), OLD)
        self.assertEqual(self.ftp.files['/anydj.de/public/index.html'], b'old homepage')
        self.assertNotIn('/anydj.de/previous.json', self.ftp.files)

    def test_failed_directory_swap_restores_original_public(self):
        self.ftp.fail_public_swap = True
        with self.assertRaises(ftplib.error_perm):
            deploy.deploy(self.ftp, self.config, 'deploy', self.bundle)
        self.assertEqual(self.current(), OLD)
        self.assertEqual(self.ftp.files['/anydj.de/public/index.html'], b'old homepage')

    def test_prune_rejects_symlinks_before_deleting_any_release(self):
        deploy.deploy(self.ftp, self.config, 'deploy', self.bundle)
        unsafe = '20250101000000-ffffffffffff'
        self.seed_release(unsafe)
        original = self.ftp.mlsd
        self.ftp.mlsd = lambda path: iter([('link', {'type': 'OS.unix=slink'})]) if path.endswith(unsafe) else original(path)
        before = dict(self.ftp.files)
        with self.assertRaises(ValueError):
            deploy.deploy(self.ftp, self.config, 'prune', expected_release=NEW)
        self.assertEqual(before, self.ftp.files)

    def test_public_keeps_hoster_files_and_removes_only_old_managed_assets(self):
        self.ftp.files['/anydj.de/public/.htaccess'] = b'host configuration'
        self.ftp.files['/anydj.de/public/obsolete.js'] = b'old asset'
        self.ftp.files['/anydj.de/releases/' + OLD + '/public/obsolete.js'] = b'old asset'
        deploy.deploy(self.ftp, self.config, 'deploy', self.bundle)
        self.assertEqual(self.ftp.files['/anydj.de/public/.htaccess'], b'host configuration')
        self.assertNotIn('/anydj.de/public/obsolete.js', self.ftp.files)
        self.assertFalse(any('public-backup-' in p or 'public-stage-' in p for p in self.ftp.dirs))

    def seed_release(self, release, complete=True):
        path = '/anydj.de/releases/' + release
        self.ftp.dirs.update([path, path + '/public'])
        self.ftp.files[path + '/public/index.html'] = b'archive'
        if complete:
            self.ftp.files[path + '/server.mjs'] = b'server'

    def test_prune_keeps_active_previous_and_one_more_complete_release(self):
        deploy.deploy(self.ftp, self.config, 'deploy', self.bundle)
        older = '20260102000000-cccccccccccc'
        newest_backup = '20260103000000-dddddddddddd'
        incomplete = '20260301000000-eeeeeeeeeeee'
        for name in [older, newest_backup]:
            self.seed_release(name)
        self.seed_release(incomplete, complete=False)
        self.ftp.dirs.add('/anydj.de/releases/unrelated')
        self.ftp.files['/anydj.de/releases/unrelated/keep.txt'] = b'keep'
        result = deploy.deploy(self.ftp, self.config, 'prune', expected_release=NEW)
        self.assertEqual(set(result['kept']), {OLD, NEW, newest_backup})
        self.assertEqual(set(result['removed']), {older, incomplete})
        self.assertIn('/anydj.de/releases/unrelated/keep.txt', self.ftp.files)
        self.assertEqual(self.current(), NEW)

    def test_prune_refuses_stale_healthcheck_or_missing_previous_release(self):
        deploy.deploy(self.ftp, self.config, 'deploy', self.bundle)
        before = dict(self.ftp.files)
        with self.assertRaises(ValueError):
            deploy.deploy(self.ftp, self.config, 'prune', expected_release=OLD)
        self.assertEqual(self.ftp.files, before)
        self.ftp.files['/anydj.de/previous.json'] = json.dumps({'release': '20250101000000-cccccccccccc'}).encode()
        before = dict(self.ftp.files)
        with self.assertRaises(ValueError):
            deploy.deploy(self.ftp, self.config, 'prune', expected_release=NEW)
        self.assertEqual(self.ftp.files, before)

    def test_public_copy_must_match_release_archive(self):
        (self.bundle / 'public/index.html').write_text('different build')
        with self.assertRaises(ValueError):
            deploy.plan_bundle(self.bundle)

    def test_crash_writes_marker_without_switching_release(self):
        deploy.deploy(self.ftp, self.config, 'crash')
        self.assertIn('/anydj.de/tmp/anydj-crash-restart', self.ftp.files)
        self.assertNotIn('/anydj.de/tmp/restart.txt', self.ftp.files)
        self.assertEqual(self.current(), OLD)

    def test_lock_refuses_concurrent_deploy(self):
        self.ftp.dirs.add('/anydj.de/tmp/deploy.lock')
        with self.assertRaises(ValueError):
            deploy.deploy(self.ftp, self.config, 'deploy', self.bundle)
        self.assertEqual(self.current(), OLD)

    def test_hidden_files_and_symlinks_are_not_uploaded(self):
        (self.bundle / '.env').write_text('not a real credential')
        with self.assertRaises(ValueError):
            deploy.plan_bundle(self.bundle)
        (self.bundle / '.env').unlink()
        (self.bundle / 'releases' / NEW / 'public' / 'linked.js').symlink_to(self.bundle / 'index.js')
        with self.assertRaises(ValueError):
            deploy.plan_bundle(self.bundle)

    def test_jailed_root_deploy_restart_and_rollback_use_single_slash(self):
        self.config['localDir'] = '/'
        self.ftp.dirs = {path.removeprefix('/anydj.de') or '/' for path in self.ftp.dirs}
        self.ftp.files = {path.removeprefix('/anydj.de'): data for path, data in self.ftp.files.items()}
        deploy.deploy(self.ftp, self.config, 'deploy', self.bundle)
        self.assertEqual(json.loads(self.ftp.files['/current.json'])['release'], NEW)
        self.assertIn('/releases/' + NEW + '/public/index.html', self.ftp.files)
        deploy.deploy(self.ftp, self.config, 'restart')
        self.assertIn('/tmp/restart.txt', self.ftp.files)
        deploy.deploy(self.ftp, self.config, 'crash')
        self.assertIn('/tmp/anydj-crash-restart', self.ftp.files)
        deploy.deploy(self.ftp, self.config, 'rollback')
        self.assertEqual(json.loads(self.ftp.files['/current.json'])['release'], OLD)
        self.assertEqual(self.ftp.files['/unrelated.txt'], b'keep')
        self.assertNotIn('/tmp/deploy.lock', self.ftp.dirs)
        self.assertTrue(all(not path.startswith('//') for path in self.ftp.files | dict.fromkeys(self.ftp.dirs)))

    def test_config_accepts_jailed_root_and_rejects_traversal_command_injection(self):
        config = {'host': 'ftp.example.test', 'username': 'name', 'password': 'not-real', 'port': '21', 'localDir': '/anydj.de'}
        file = self.bundle / 'config.json'
        for target in ['/../other', '/./other', '/anydj.de\r\nDELE file', 'relative']:
            file.write_text(json.dumps({**config, 'localDir': target}))
            with self.assertRaises(ValueError):
                deploy.load_config(file)
        file.write_text(json.dumps(config))
        self.assertTrue(deploy.load_config(file).get('secure', True))
        for target, normalized in [('/', '/'), ('///', '/'), ('/anydj.de/', '/anydj.de')]:
            file.write_text(json.dumps({**config, 'localDir': target}))
            self.assertEqual(deploy.load_config(file)['localDir'], normalized)


if __name__ == '__main__':
    unittest.main()
