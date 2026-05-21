import "@testing-library/jest-dom/vitest";

// jsdom には matchMedia が無いので、テスト中だけ no-op stub を入れる。
// 履歴ページの「Mobile では List をデフォルト」検知に使う。
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}
