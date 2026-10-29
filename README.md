# Claude便り

Claude・Anthropic のニュースをまとめて読むWebアプリです。お金はかかりません。

- **まとめ**：直近1週間の件数と、公式発表・Claude Code のリリース・障害情報・話題・日本語の記事
- **新着**：公式ニュース、Claude Code のリリース、稼働状況、YouTube、Hacker News、Reddit、Zenn、Qiita を新しい順に
- **リンク集**：公式ページやコミュニティへの入口

## しくみ

GitHub Actions（`.github/workflows/feeds.yml`）が1時間ごとに `fetch-claude.mjs` を動かし、新着を `feeds.json` に保存します。画面（`index.html`）はこのファイルを読むだけです。公開リポジトリなら GitHub Pages と Actions は無料です。

## 設定

1. **Settings → Pages** で、`main` ブランチの `/ (root)` を公開します。
2. **Actions** タブで「Claudeの新着を集める」を一度手動で実行すると、すぐに最新の状態になります。
