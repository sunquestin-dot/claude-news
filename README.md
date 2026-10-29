# Claude便り

Claude・Anthropic のニュースを、日本語の要約つきでまとめて読むWebアプリです。

- **まとめ**：直近1週間の重要なできごと（AIが日本語でまとめたもの）と、公式発表・Claude Code のリリース・障害情報
- **新着**：公式ニュース、Claude Code のリリース、稼働状況、YouTube、Hacker News、Reddit、Zenn、Qiita を新しい順に
- **リンク集**：公式ページやコミュニティへの入口

## しくみ

GitHub Actions（`.github/workflows/feeds.yml`）が1時間ごとに `fetch-claude.mjs` を動かし、新着を `feeds.json` に保存します。画面（`index.html`）はこのファイルを読むだけです。

## 設定

1. **Settings → Pages** で、`main` ブランチの `/ (root)` を公開します。
2. **Settings → Secrets and variables → Actions** に `ANTHROPIC_API_KEY` を登録すると、英語の記事に日本語の見出しと要約が付き、週のまとめが作られます（なくても記事の一覧は動きます）。
3. **Actions** タブで「Claudeの新着を集める」を一度手動で実行すると、すぐに最新の状態になります。
