type ResourceItem = {
  _: string;
  $: {
    name: string;
  };
};

type ResourceStyle = {
  $: {
    name: string;
    parent: string;
  };
  item: ResourceItem[];
};

type AndroidStyles = {
  resources: {
    style: ResourceStyle[];
  };
};

const { applyAndroidAutofillHighlight } = jest.requireActual(
  "../../../plugins/withAndroidAutofillHighlight"
) as {
  applyAndroidAutofillHighlight: (styles: AndroidStyles) => AndroidStyles;
};

const autofilledHighlightName = "android:autofilledHighlight";
const transparentAndroidColor = "@android:color/transparent";

function makeStyles(appThemeItems: ResourceItem[]): AndroidStyles {
  return {
    resources: {
      style: [
        {
          $: {
            name: "AppTheme",
            parent: "Theme.AppCompat.Light.NoActionBar"
          },
          item: appThemeItems
        },
        {
          $: { name: "UnrelatedTheme", parent: "Theme.AppCompat" },
          item: [
            { $: { name: "android:windowLightStatusBar" }, _: "true" }
          ]
        }
      ]
    }
  };
}

function cloneStyles(styles: AndroidStyles): AndroidStyles {
  return JSON.parse(JSON.stringify(styles)) as AndroidStyles;
}

function getAppTheme(styles: AndroidStyles): ResourceStyle {
  const result = styles.resources.style.find(
    (style) => style.$.name === "AppTheme"
  );

  if (!result) {
    throw new Error("Missing AppTheme fixture");
  }

  return result;
}

function getAutofillItems(styles: AndroidStyles): ResourceItem[] {
  return getAppTheme(styles).item.filter(
    (item) => item.$.name === autofilledHighlightName
  );
}

describe("withAndroidAutofillHighlight", () => {
  it("adds the transparent highlight once and preserves unrelated resources", () => {
    const styles = makeStyles([
      { $: { name: "android:windowLightStatusBar" }, _: "true" },
      { $: { name: "android:colorAccent" }, _: "@color/colorAccent" }
    ]);
    const unrelatedTheme = cloneStyles(styles).resources.style[1];

    const once = applyAndroidAutofillHighlight(styles);
    const onceSnapshot = cloneStyles(once);
    const twice = applyAndroidAutofillHighlight(once);

    expect(getAutofillItems(twice)).toEqual([
      {
        $: { name: autofilledHighlightName },
        _: transparentAndroidColor
      }
    ]);
    expect(getAppTheme(twice).item).toEqual(
      expect.arrayContaining([
        { $: { name: "android:windowLightStatusBar" }, _: "true" },
        { $: { name: "android:colorAccent" }, _: "@color/colorAccent" }
      ])
    );
    expect(twice.resources.style[1]).toEqual(unrelatedTheme);
    expect(twice).toEqual(onceSnapshot);
  });

  it("replaces conflicting and duplicate highlight items", () => {
    const styles = makeStyles([
      { $: { name: autofilledHighlightName }, _: "@color/yellow" },
      { $: { name: "android:windowActionModeOverlay" }, _: "true" },
      { $: { name: autofilledHighlightName }, _: "@color/orange" }
    ]);

    const result = applyAndroidAutofillHighlight(styles);

    expect(getAutofillItems(result)).toEqual([
      {
        $: { name: autofilledHighlightName },
        _: transparentAndroidColor
      }
    ]);
    expect(getAppTheme(result).item).toContainEqual({
      $: { name: "android:windowActionModeOverlay" },
      _: "true"
    });
  });
});
