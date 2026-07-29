# Crypto Trade Sim 🪙

暗号通貨の **デモトレード（Paper Trading）** ＋ **戦略検証** ＋ **日本の税金シミュレーション** を1つにした Web アプリです。
実資金を使わずに練習・検証でき、日本の税制（現行の総合課税／2028年以降に議論されている分離課税）を考慮した **手取り利益** を試算できます。

> ⚠️ 本ツールはシミュレーション目的であり、投資助言・税務助言ではありません。最終判断は自己責任でお願いします。

---

## 主な機能

| 機能 | 内容 |
|---|---|
| **デモトレード** (`/trade`) | 仮想資金で BTC/ETH/SOL を成行・指値、ロング/ショート、レバレッジ最大20x。実現/未実現損益をリアルタイム表示 |
| **税金シミュレーション** (`/tax-simulator`) | 現行の累進課税（5〜45%＋復興特別＋住民税10%）と 2028年以降の分離課税（20.315%・想定）を切替。税額・手取り・実効税率をリアルタイム計算 |
| **ダッシュボード** (`/dashboard`) | 仮想資産の推移・税引後利益の推移をグラフ表示 |
| **市場観** (`/insights`) | よく使われる手法（DCA・押し目買い・スキャルピング等）やサイクル/オンチェーン指標の議論を整理 |
| **取引履歴** (`/history`) | デモ取引・税シミュ履歴の一覧 |
| **設定** (`/settings`) | 表示名・初期仮想資金の変更、取引履歴のリセット、ログアウト |
| **AI戦略モデル比較** (`/models`) | 手法・リスクヘッジ・リターンが異なる5モデルを過去データでバックテストし、リターン/最大DD/勝率を比較。Claude API を設定すると各モデルの「AIの見立て」も表示（任意） |
| **ノート** (`/notes`) | 相場観や仮説を自由に記録 |

## 技術スタック

- **Frontend / Hosting**: Next.js 15 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **Backend / DB / Auth**: Supabase (PostgreSQL + Auth + RLS)
- **チャート**: Recharts / **フォーム**: react-hook-form + zod / **日付**: date-fns
- **価格取得**: Binance 公開データAPI（`data-api.binance.vision`）を主、CoinGecko をフォールバック（いずれも無料・キー不要、サーバーサイドで取得）
- **デプロイ**: Vercel

---

## セットアップ手順

### 0. 前提

- Node.js 20 以上
- [Supabase](https://supabase.com) アカウント（無料枠でOK）
- [Vercel](https://vercel.com) アカウント（デプロイする場合）

### 1. リポジトリ取得 & 依存インストール

```bash
git clone https://github.com/youki0p0/crypto_trade_tool.git
cd crypto_trade_tool
npm install
```

### 2. Supabase プロジェクト作成

1. [Supabase ダッシュボード](https://supabase.com/dashboard) で **New project** を作成。
2. 作成後、**Project Settings → API** を開き、以下を控える:
   - `Project URL`（例: `https://xxxx.supabase.co`）→ `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 3. データベースのスキーマ適用

このリポジトリの [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) を適用します。

- **方法A（簡単）**: Supabase ダッシュボード → **SQL Editor** に `0001_init.sql` の中身を貼り付けて **Run**。
- **方法B（CLI）**: [Supabase CLI](https://supabase.com/docs/guides/cli) をリンク済みなら `supabase db push`。

これで以下が作成されます:
- テーブル: `profiles` / `paper_trades` / `tax_simulations` / `notes`
- Row Level Security（各ユーザーは自分の行のみ read/write）
- 新規登録時に `profiles` を自動作成するトリガー

### 4. 認証（Auth）設定

Supabase ダッシュボード → **Authentication → Providers**:

- **Email**: 既定で有効。開発中は **Confirm email** をオフにするとメール確認なしで試せます。
- **Google（任意）**: Provider を有効化し、Google Cloud で作成した OAuth クライアントの Client ID / Secret を設定。
  - Google 側の「承認済みリダイレクト URI」に Supabase の `https://<project>.supabase.co/auth/v1/callback` を追加。

**Authentication → URL Configuration**:
- `Site URL` にローカルは `http://localhost:3000`、本番は Vercel の URL を設定。
- `Redirect URLs` に `http://localhost:3000/**` と本番 `https://<your-app>.vercel.app/**` を追加。

### 5. 環境変数

`.env.example` をコピーして `.env.local` を作成し、値を埋めます。

```bash
cp .env.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
# PRICE_API_BASE は通常未設定でOK（既定: data-api.binance.vision、失敗時 CoinGecko に自動フォールバック）
```

> `NEXT_PUBLIC_` 付きの変数はブラウザに露出します。anon key は RLS で保護される前提の公開キーなので問題ありませんが、**service_role key は絶対にフロントに置かないでください**（本アプリでは使用しません）。

### 6. ローカル起動

```bash
npm run dev          # http://localhost:3000
```

その他のスクリプト:

```bash
npm run build        # 本番ビルド
npm run start        # ビルド済みを起動
npm run typecheck    # tsc --noEmit
npm run test         # vitest（税・損益計算の単体テスト）
npm run lint         # next lint
```

---

## Vercel へのデプロイ

1. GitHub にリポジトリを push。
2. [Vercel](https://vercel.com/new) で **Import Project** → 対象リポジトリを選択。
3. **Environment Variables** に以下を設定（Production / Preview 両方）:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SITE_URL`（デプロイ後の本番URL。例: `https://crypto-trade-tool.vercel.app`）
4. Framework は自動で **Next.js** が選択されます。**Deploy** を実行。
5. デプロイ後の URL を、**Supabase の Site URL / Redirect URLs** にも反映（手順4）。
6. Google OAuth を使う場合は、Google Cloud の承認済みリダイレクト URI にも本番ドメインを追加。

---

## プロジェクト構成

```
app/
├─ page.tsx                  # ランディング
├─ (auth)/login/             # ログイン / 新規登録（メール & Google）
├─ auth/callback|signout/    # OAuth コールバック / サインアウト
├─ dashboard/                # 資産・税引後利益グラフ
├─ trade/                    # デモトレード（発注・ポジション・決済）
├─ tax-simulator/            # 税金シミュレーション
├─ insights/                 # 市場手法・サイクルまとめ（静的）
├─ history/  settings/  notes/
└─ api/price/route.ts        # サーバーサイド価格取得（プロキシ）
components/ (ui, layout, charts)
lib/
├─ supabase/ (client, server, middleware)
├─ tax/      (calc, schema, tests)   ← 税制計算エンジン
├─ trade/    (pnl, schema, tests)    ← 損益計算
├─ market/   (price)                 ← 価格取得（Binance → CoinGecko）
└─ data/     (queries, portfolio)
supabase/migrations/0001_init.sql    # スキーマ + RLS + trigger
middleware.ts                        # 認証によるルート保護
```

---

## 税計算について

- **現行（総合課税）**: 暗号資産の利益は「雑所得」として他の所得に上乗せされ累進課税されます。本アプリは
  `T(他の所得 + 暗号資産利益) − T(他の所得)` の**限界差分**で暗号資産利益への帰属税額を算出します
  （所得税＝速算表、復興特別所得税＝所得税×2.1%、住民税＝10%）。
- **2028年以降（申告分離課税・想定）**: 一律 **20.315%**（所得税15%＋復興0.315%＋住民5%）。
  これは**議論段階の想定であり未確定**です。
- あくまで概算です。各種所得控除・社会保険料控除・均等割・損益通算の細則は考慮していません。
  正確な申告は[国税庁](https://www.nta.go.jp/)の情報や税理士にご確認ください。

計算ロジックは純粋関数として [`lib/tax/calc.ts`](lib/tax/calc.ts) にあり、[`lib/tax/calc.test.ts`](lib/tax/calc.test.ts) でテストされています。

## AI戦略モデル（`/models`）について

手法・リスクヘッジ・リターンの大きさが異なる **5つの戦略モデル** を過去データでバックテストして比較します。

| モデル | 手法 | リスク |
|---|---|---|
| DCA-Guardian | ドルコスト平均法（積立・現物） | 低 |
| Range-Sniper | RSI逆張りの押し目買い | 中低 |
| Trend-Rider | EMAトレンドフォロー | 中 |
| Breakout-Hunter | ドンチャン・ブレイクアウト | 中高 |
| Momentum-Blitz | 高レバ短期モメンタム | 高 |

- **バックテスト**（既定・キー不要）: 決定論的なテクニカルルールで過去のローソク足を走らせ、リターン／最大ドローダウン／勝率を比較。ロジックは [`lib/models/`](lib/models/) に純粋関数として実装しテスト済み。
- **AIの見立て**（任意・Human Gate）: `ANTHROPIC_API_KEY` を設定すると、Claude（既定 `claude-opus-4-8`、`ANTHROPIC_MODEL` で変更可）が最新のマーケットスナップショットに対する各モデルの売買サイン・確信度・根拠を返します。サーバーサイド（`/api/models/advice`）でのみ呼び出し、キー未設定でもバックテストは完全に動作します。

> ⚠️ 過去のバックテスト結果は将来の成績を保証しません。レバレッジ戦略はロスカットで資金を大きく失う可能性があります。投資助言ではありません。

## ライセンス

MIT
