const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const analysis=process.env.ANYDJ_ANALYSIS_BUNDLE;
const manifest=analysis?JSON.parse(readFileSync(join(analysis,'manifest.json'),'utf8')):null;
module.exports = {
  appId: 'de.anydj.desktop',
  productName: 'AnyDj',
  executableName: 'anydj',
  asar: true,
  directories: {output: process.env.ANYDJ_DESKTOP_OUTPUT || 'dist'},
  files: ['desktop/**/*', 'server.mjs', 'lib/**/*', 'public/**/*', 'package.json'],
  beforePack:async context=>{const {prepareVideoBinary}=await import('../scripts/prepare-video-binary.mjs');await prepareVideoBinary(context.electronPlatformName,require('builder-util').Arch[context.arch]);},
  extraResources: [{from: '.build/build-flavor.json',to:'build-flavor.json'},{from:'.build/video/${os}-${arch}',to:'video',filter:['ffmpeg*','LICENSE']},...(analysis?[{from:analysis,to:'analysis',filter:['**/*']}]:[])],
  artifactName: '${productName}-${version}-${os}-${arch}.${ext}',
  linux: {icon: 'desktop/icons/linux', target: ['AppImage', 'deb'], category: 'AudioVideo', maintainer: 'AnyDj', synopsis: 'Musik und Licht lokal mischen'},
  ...(manifest?.platform==='linux'&&manifest.glibc?{deb:{depends:['libgtk-3-0','libnotify4','libnss3','libxss1','libxtst6','xdg-utils','libatspi2.0-0','libuuid1','libsecret-1-0',`libc6 (>= ${manifest.glibc})`]}}:{}),
  win: {icon: 'desktop/icons/icon.ico', target: ['nsis']},
  mac: {icon: 'desktop/icons/icon.icns', target: ['dmg'], category: 'public.app-category.music'},
  nsis: {oneClick: false, perMachine: false, allowToChangeInstallationDirectory: true},
  npmRebuild: false,
  publish: null
};
