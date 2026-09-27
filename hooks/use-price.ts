"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { TickerPrice } from "@/lib/market/price";

interface UsePriceState {
  prices: Record<string, TickerPrice>;
  loading: boolean;
  error: string | null;
}

/**
 * /api/price を一定間隔でポーリングして最新価格を返す。
 */
export function usePrice(symbols: string[], intervalMs = 5000) {
  const [state, setState] = useState<UsePriceState>({
    prices: {},
    loading: true,
    error: null,
  });
  const symbolsKey = symbols.join(",");
  const mounted = useRef(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/price?symbols=${encodeURIComponent(symbolsKey)}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const json = (await res.json()) as { tickers: TickerPrice[] };
      if (!mounted.current) return;
      const map: Record<string, TickerPrice> = {};
      for (const t of json.tickers) map[t.symbol] = t;
      setState({ prices: map, loading: false, error: null });
    } catch (e) {
      if (!mounted.current) return;
      setState((s) => ({
        ...s,
        loading: false,
        error: e instanceof Error ? e.message : "価格取得に失敗しました",
      }));
    }
  }, [symbolsKey]);

  useEffect(() => {
    mounted.current = true;
    load();
    const id = setInterval(load, intervalMs);
    return () => {
      mounted.current = false;
      clearInterval(id);
    };
  }, [load, intervalMs]);

  return { ...state, refetch: load };
}
