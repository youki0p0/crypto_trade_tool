/**
 * Supabase テーブルの型定義。
 * `supabase gen types typescript` の出力に相当する手書き版。
 * スキーマ変更時は supabase/migrations と合わせて更新すること。
 */

export type TradeSide = "long" | "short";
export type OrderType = "market" | "limit";
export type TaxMode = "current_progressive" | "separate_2028";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          display_name: string | null;
          initial_balance: number;
          created_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          display_name?: string | null;
          initial_balance?: number;
          created_at?: string;
        };
        Update: {
          email?: string | null;
          display_name?: string | null;
          initial_balance?: number;
        };
        Relationships: [];
      };
      paper_trades: {
        Row: {
          id: string;
          user_id: string;
          symbol: string;
          side: TradeSide;
          type: OrderType;
          price: number;
          quantity: number;
          leverage: number;
          pnl: number | null;
          status: string;
          closed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          symbol: string;
          side: TradeSide;
          type: OrderType;
          price: number;
          quantity: number;
          leverage?: number;
          pnl?: number | null;
          status?: string;
          closed_at?: string | null;
          created_at?: string;
        };
        Update: {
          price?: number;
          quantity?: number;
          leverage?: number;
          pnl?: number | null;
          status?: string;
          closed_at?: string | null;
        };
        Relationships: [];
      };
      tax_simulations: {
        Row: {
          id: string;
          user_id: string;
          crypto_profit: number;
          other_income: number;
          tax_mode: TaxMode;
          tax_amount: number;
          net_profit: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          crypto_profit: number;
          other_income: number;
          tax_mode: TaxMode;
          tax_amount: number;
          net_profit: number;
          created_at?: string;
        };
        Update: {
          crypto_profit?: number;
          other_income?: number;
          tax_mode?: TaxMode;
          tax_amount?: number;
          net_profit?: number;
        };
        Relationships: [];
      };
      notes: {
        Row: {
          id: string;
          user_id: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          content: string;
          created_at?: string;
        };
        Update: {
          content?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type PaperTrade = Database["public"]["Tables"]["paper_trades"]["Row"];
export type TaxSimulation = Database["public"]["Tables"]["tax_simulations"]["Row"];
export type Note = Database["public"]["Tables"]["notes"]["Row"];
