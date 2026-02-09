# AI Agent Instructions for ar_meishi_techconnect

このプロジェクトでコード変更を行う際の重要な注意事項です。

## 🚨 重要: Service Worker キャッシュの更新

このプロジェクトでは **Service Worker** (`sw.js`) を使用してアセットをキャッシュしています。

### アセットを更新した場合は必ずキャッシュバージョンを上げてください

以下のファイルを変更した場合、`sw.js` の `CACHE_VERSION` を必ずインクリメントしてください：

- `assets/` 内の画像・動画ファイル
- `index.html`
- `script.js`

**変更箇所** (`sw.js` の3行目):
```javascript
const CACHE_VERSION = 'v2';  // ← この数字を v3, v4... とインクリメント
```

### なぜ必要か

Service Workerはブラウザにアセットをキャッシュします。キャッシュバージョンを更新しないと、ユーザーのブラウザに古いファイルが表示され続けます。

## プロジェクト構成

- **ホスティング**: GitHub Pages
- **ARライブラリ**: MindAR + A-Frame
- **主要ファイル**:
  - `index.html` - メインHTML
  - `script.js` - アニメーション・イベント処理
  - `sw.js` - Service Worker（キャッシュ管理）
  - `assets/` - 画像・動画・ARターゲット
