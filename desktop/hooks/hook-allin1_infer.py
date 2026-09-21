from PyInstaller.utils.hooks import collect_all, copy_metadata
datas, binaries, hiddenimports = collect_all('allin1_infer')
datas += copy_metadata('all-in-one-infer')
