const {
  AndroidConfig,
  withAndroidStyles
} = require("expo/config-plugins");

const autofilledHighlightName = "android:autofilledHighlight";
const transparentAndroidColor = "@android:color/transparent";
const appTheme = AndroidConfig.Styles.getAppThemeGroup();

function applyAndroidAutofillHighlight(styles) {
  const theme = AndroidConfig.Styles.getStyleParent(styles, appTheme);

  if (theme?.item) {
    theme.item = theme.item.filter(
      (item) => item.$.name !== autofilledHighlightName
    );
  }

  return AndroidConfig.Styles.assignStylesValue(styles, {
    add: true,
    name: autofilledHighlightName,
    parent: appTheme,
    value: transparentAndroidColor
  });
}

function withAndroidAutofillHighlight(config) {
  // This changes ShiftPay's generated native theme; Expo Go keeps its own host theme.
  return withAndroidStyles(config, (modConfig) => {
    modConfig.modResults = applyAndroidAutofillHighlight(modConfig.modResults);
    return modConfig;
  });
}

module.exports = withAndroidAutofillHighlight;
module.exports.applyAndroidAutofillHighlight =
  applyAndroidAutofillHighlight;

