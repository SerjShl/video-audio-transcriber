import { useEffect, useState } from "react";

export function usePersistentState(
  key: string,
  initial: string,
  allowed?: readonly string[],
): [string, (value: string) => void] {
  const [value, setValue] = useState<string>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null && (!allowed || allowed.includes(raw))) {
        return raw;
      }
    } catch {
      return initial;
    }
    return initial;
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, value);
    } catch {
      return;
    }
  }, [key, value]);

  return [value, setValue];
}
