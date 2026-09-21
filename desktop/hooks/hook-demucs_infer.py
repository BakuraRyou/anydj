from PyInstaller.utils.hooks import collect_all, copy_metadata
datas, binaries, hiddenimports = collect_all('demucs_infer')
datas += copy_metadata('demucs-infer')
