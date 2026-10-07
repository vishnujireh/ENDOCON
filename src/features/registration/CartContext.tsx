import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Cart } from '../../api/types';

/**
 * The user's in-progress selection for the CURRENT purchase. Temporary UI state only – it holds
 * IDs/choices, never prices. Kept in sessionStorage so a page refresh doesn't lose it; everything
 * purchased lives on the server.
 */
const EMPTY: Cart = { conferenceCategoryCode: null, workshopCodes: [], accommodation: null, accompanyingPersons: [] };
const KEY = 'endocon.cart.v2'; // v2: catalogue codes instead of numeric IDs

interface CartState {
  cart: Cart;
  setConference: (code: string | null) => void;
  toggleWorkshop: (code: string) => void;
  setAccommodation: (a: Cart['accommodation']) => void;
  setAccompanying: (people: Cart['accompanyingPersons']) => void;
  clear: () => void;
  isEmpty: boolean;
}

const Ctx = createContext<CartState | null>(null);

function load(): Cart {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<Cart>(load);

  useEffect(() => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(cart));
    } catch {
      /* storage unavailable – in-memory only */
    }
  }, [cart]);

  const setConference = useCallback((code: string | null) => setCart((c) => ({ ...c, conferenceCategoryCode: code })), []);
  const toggleWorkshop = useCallback(
    (code: string) =>
      setCart((c) => ({
        ...c,
        // A workshop can only be selected once – the set semantics prevent duplicates.
        workshopCodes: c.workshopCodes.includes(code) ? c.workshopCodes.filter((w) => w !== code) : [...c.workshopCodes, code],
      })),
    [],
  );
  const setAccommodation = useCallback((a: Cart['accommodation']) => setCart((c) => ({ ...c, accommodation: a })), []);
  const setAccompanying = useCallback((people: Cart['accompanyingPersons']) => setCart((c) => ({ ...c, accompanyingPersons: people })), []);
  const clear = useCallback(() => setCart(EMPTY), []);

  const isEmpty = !cart.conferenceCategoryCode && cart.workshopCodes.length === 0 && !cart.accommodation && cart.accompanyingPersons.length === 0;

  const value = useMemo(
    () => ({ cart, setConference, toggleWorkshop, setAccommodation, setAccompanying, clear, isEmpty }),
    [cart, setConference, toggleWorkshop, setAccommodation, setAccompanying, clear, isEmpty],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart(): CartState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>');
  return ctx;
}

/** Remove choices that are no longer purchasable (e.g. bought in another tab). */
export function sanitizeCart(cart: Cart, held: { conference: boolean; workshopCodes: string[]; accommodation: boolean }): Cart {
  return {
    conferenceCategoryCode: held.conference ? null : cart.conferenceCategoryCode,
    workshopCodes: cart.workshopCodes.filter((code) => !held.workshopCodes.includes(code)),
    accommodation: held.accommodation ? null : cart.accommodation,
    accompanyingPersons: cart.accompanyingPersons.filter((p) => p.fullName.trim()),
  };
}
