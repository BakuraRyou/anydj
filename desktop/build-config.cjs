const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const analysis=process.env.ANYDJ_ANALYSIS_BUNDLE;
const manifest=analysis?JSON.parse(readFileSync(join(analysis,'manifest.json'),'utf8')):null;
module.exports = {
  appId: 'de.anydj.desktop',
  productName: 'AnyDj',
  executableName: 'anydj',
  asar: true,
  directories: {output: 'dist'},
  files: ['desktop/**/*', 'server.mjs', 'lib/**/*', 'public/**/*', 'package.json'],
  extraResources: [{from: '.build/build-flavor.json',to:'build-flavor.json'},...(analysis?[{from:analysis,to:'analysis',filter:['**/*']}]:[])],
  artifactName: '${productName}-${version}-${os}-${arch}.${ext}',
  linux: {target: ['AppImage', 'deb'], category: 'AudioVideo', maintainer: 'AnyDj', synopsis: 'Musik und Licht lokal mischen'},
  ...(manifest?.platform==='linux'&&manifest.glibc?{deb:{depends:['libgtk-3-0','libnotify4','libnss3','libxss1','libxtst6','xdg-utils','libatspi2.0-0','libuuid1','libsecret-1-0',`libc6 (>= ${manifest.glibc})`]}}:{}),
  win: {target: ['nsis']},
  nsis: {oneClick: false, perMachine: false, allowToChangeInstallationDirectory: true},
  npmRebuild: false,
  publish: null
};
