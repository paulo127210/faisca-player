/**
 * Plugin de configuração: deixa o APK instalável e visível no Android TV
 * (Google TV, Fire Stick e TV boxes), sem exigir tela de toque.
 */
const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withAndroidTV(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;

    manifest['uses-feature'] = manifest['uses-feature'] || [];
    for (const nome of ['android.software.leanback', 'android.hardware.touchscreen']) {
      if (!manifest['uses-feature'].some((f) => f.$['android:name'] === nome)) {
        manifest['uses-feature'].push({ $: { 'android:name': nome, 'android:required': 'false' } });
      }
    }

    const app = manifest.application[0];
    const principal = app.activity.find((a) => a.$['android:name'] === '.MainActivity') || app.activity[0];
    const filtros = principal['intent-filter'] || [];
    const lancador = filtros.find((f) =>
      (f.action || []).some((a) => a.$['android:name'] === 'android.intent.action.MAIN'),
    );
    if (lancador) {
      lancador.category = lancador.category || [];
      if (!lancador.category.some((c) => c.$['android:name'] === 'android.intent.category.LEANBACK_LAUNCHER')) {
        lancador.category.push({ $: { 'android:name': 'android.intent.category.LEANBACK_LAUNCHER' } });
      }
    }
    return cfg;
  });
};
