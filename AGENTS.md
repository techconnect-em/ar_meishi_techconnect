# AI Agent Instructions for ar_meishi_techconnect

このプロジェクトでコード変更を行う際の重要な注意事項です。

## プロジェクト構成

- **ARエンジン**: 8th Wall オープンソース版（セルフホスト） + Three.js + Vite
  - 旧構成（MindAR + A-Frame + Service Worker）から2026年7月に移行済み
- **ホスティング**: GitHub Pages（GitHub Actionsでビルド＆デプロイ、`.github/workflows/deploy.yml`）
- **主要ファイル**:
  - `src/pipelineModule.js` - ARシーン本体（アニメーションのタイムライン・タップ処理）
  - `src/main.js` - AR初期化
  - `public/xr/`, `public/xrextras/` - 8th Wall SDK（**編集禁止**。更新は参照プロジェクトからコピー）
  - `public/image-targets/` - マーカーデータ（`scripts/generate-marker.mjs` で生成）

## 🚨 注意事項

- `src/main.js` の `window.THREE = THREE` は削除禁止（XR8のThree.jsモジュールが要求）
- パイプラインの `XRExtras.AlmostThere` / `FullWindowCanvas` / `RuntimeError` は常に残す
- `index.html` のSDK読み込みタグの `data-cfasync="false"` を外さない（Cloudflare配信時の事故防止）
- マーカー名（generate-marker.mjs の第3引数）と `pipelineModule.js` の `detail.name === 'marker'` 判定は一致させる
- `public/sw.js` は旧版のService Workerを解除するキルスイッチ。**削除しないこと**（旧版訪問者のキャッシュ掃除に必要）。新たなService Workerの登録もしない
- Vite の `base: './'` を変えない（GitHub Pagesのサブパス配信で必要）

## 座標系メモ（重要）

- 8th Wall公式のマーカー生成は「**横長画像は90°回転して縦長として処理し `isRotated: true` を付け、
  中央を3:4にクロップして追跡領域にする**」仕様。`scripts/generate-marker.mjs` はこれを再現している。
  回転やクロップを省くと**トラッキングの向きが90°ズレ、サイズも合わなくなる**（2026-07-15に実機で確認済み）
- シーン単位は「追跡領域（3:4クロップ）の高さ = 1」。カードの実寸（シーン単位）は
  `pipelineModule.js` がマーカーJSONの `properties` から算出する（isRotated時は
  originalWidth/Height が回転後座標で幅高さが入れ替わっている点に注意）
- 旧MindAR版は「カード幅=1」の単位系だったため、`contentRoot` をカード幅ぶんスケールして
  旧座標をそのまま使っている
