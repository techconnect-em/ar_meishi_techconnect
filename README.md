# AR Meishi TechConnect

WebAR名刺アプリケーション - MindAR + A-Frameを使用したAR体験

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

- [A-Frame](https://aframe.io/) v1.4.2 - WebVR/ARフレームワーク
- [MindAR](https://hiukim.github.io/mind-ar-js-doc/) v1.2.2 - 画像トラッキングライブラリ

## ファイル構成

```
ar_meishi_techconnect/
├── index.html      # メインHTML（A-Frameシーン、UI）
├── script.js       # アニメーション・インタラクション制御
├── assets/
│   ├── target.mind          # MindARターゲットファイル
│   ├── meishi_front.png     # 名刺表面
│   ├── meishi_inside.png    # 名刺内面
│   ├── logoanimation.mp4    # ロゴアニメーション動画
│   ├── intro_profile.jpg    # プロフィール写真
│   ├── intro_name.png       # 名前画像
│   ├── intro_job.png        # 職種画像
│   ├── intro_catch.png      # キャッチフレーズ画像
│   ├── icon_instagram.png   # Instagramアイコン
│   ├── icon_website.png     # Websiteアイコン
│   └── icon_potfolio.png    # Portfolioアイコン
└── README.md
```

## ローカル開発

```bash
# サーバー起動
npx http-server . -c-1

# ブラウザでアクセス
# Local: http://127.0.0.1:8080
# スマホ: http://<your-ip>:8080
```

## 使用方法

1. スマートフォンでURLにアクセス
2. カメラへのアクセスを許可
3. 名刺（ターゲット画像）にカメラを向ける
4. ARコンテンツが表示される

## ライセンス

Private
