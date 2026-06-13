The app bundles Noto Serif CJK SC fonts for Android in:

`app/android/app/src/main/assets/fonts/`

Files currently included:

- `NotoSerifCJKsc-Regular.otf`
- `NotoSerifCJKsc-Medium.otf`
- `NotoSerifCJKsc-SemiBold.otf`

React Native Android resolves these by file base name, so the theme uses
`NotoSerifCJKsc-Regular`, `NotoSerifCJKsc-Medium`, and
`NotoSerifCJKsc-SemiBold`.
