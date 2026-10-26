# CLAUDE.md

## ドキュメントとコードが食い違うときの扱い（最優先）

When a repository's documentation and its existing code disagree, follow the
conventions used in the existing code, and in your final reply point out each
inconsistency you found between the documentation and the code.

ドキュメント（この CLAUDE.md・README.md・コード中のコメント）と既存のコードが食い違うときは、
**コードの書き方に従い**、見つけた食い違いを**最後の返答ですべて挙げること**。
ドキュメントに合わせて動いているコードを書き換えないこと。

> 根拠: Xu & Wu, *Stale Instruction Files Override the Code in Coding Agents: A One-Sentence Fix*
> (arXiv:2610.30571). 指示ファイルが古いとき、エージェントは食い違いに気づいていても
> 90.1% が古い記述に従った。上記1文の追加で 91.4% がコード側に従うようになり、
> 既存コードの書き換えはゼロ、テスト通過率は 89.4% → 100% になった。

## このリポジトリの要点

- Next.js 15 (App Router) + TypeScript + Tailwind + shadcn/ui / Supabase / Vercel
- テスト: `npm test`（vitest）。`lib/` のロジックは純粋関数として実装しテストする
- Lint: `npm run lint`
- 戦略モデルの一次情報は `lib/models/strategies.ts` の `MODELS`。
  モデル数・一覧をドキュメントやUIに書くときは `MODELS` から導出し、数値をハードコードしない
