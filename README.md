# AR Meishi TechConnect

WebAR名刺アプリケーション - 8th Wall（オープンソース版・セルフホスト）+ Three.js + Vite

## 概要

紙の名刺にスマートフォンをかざすと、ARでホログラム風のインタラクティブなコンテンツが表示される名刺アプリケーションです。

## 機能

- **カード開封アニメーション**: 名刺を認識すると、カバーが開くアニメーション
- **ロゴ動画再生**: ロゴアニメーション動画の自動再生
- **自己紹介ホログラム**: プロフィール写真、名前、キャッチフレーズ、職種をホログラム風に表示
- **リンクボタン**:
  - Website: LPサイト (`https://techconnect-em.com`)
  - Instagram: Instagramプロフィール
  - Portfolio: 制作実績リスト（ARチラシ、AR CD、ARフォトフレーム、AR恐竜BOX）

## 技術スタック

- [8th Wall](https://github.com/8thwall/web) オープンソース版（セルフホスト・APIキー不要） - 画像トラッキング
- [Three.js](https://threejs.org/) - 3D描画
- [Vite](https://vitejs.dev/) - ビルドツール

## ファイル構成

```
ar_meishi_techconnect/
├── index.html                  # エントリHTML（8th Wall SDK読み込み）
├── vite.config.js              # Vite設定（HTTPS開発サーバー・相対パスビルド）
├── src/
│   ├── main.js                 # AR初期化（マーカー設定・パイプライン登録）
│   ├── pipelineModule.js       # ARシーン本体（アニメーション・インタラクション）
│   ├── customLoading.js        # Tech Connectブランドのローディング画面
│   └── style.css
├── scripts/
│   └── generate-marker.mjs     # マーカーデータ生成スクリプト
├── public/
│   ├── xr/                     # 8th Wall SDK（ビルド済み）
│   ├── xrextras/               # 8th Wall UI/UXモジュール
│   ├── image-targets/          # マーカーデータ（meishi_front.png から生成）
│   ├── sw.js                   # 旧Service Worker解除用キルスイッチ
│   └── assets/                 # 画像・動画
└── .github/workflows/deploy.yml # GitHub Pages自動デプロイ
```

## 開発

```bash
npm install
npm run dev   # https://localhost:5173（スマホからはネットワークURLで）
```

マーカーを変更する場合（例: 名刺デザイン刷新時）:

```bash
npm install --no-save sharp
node scripts/generate-marker.mjs public/assets/meishi_front.png public/image-targets marker
```

## デプロイ

GitHub Pages（GitHub Actions経由）。`main` にpushすると自動でビルド＆デプロイされる。
初回のみ、リポジトリの Settings → Pages → Source を「GitHub Actions」に変更すること。

## 使用方法

1. スマートフォンでURLにアクセス
2. カメラへのアクセスを許可
3. 名刺（表面）にカメラを向ける
4. ARコンテンツが表示される

## ライセンス

Private
