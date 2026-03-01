export const themeConfig = {
  name: "Sabor & Cia",
  colors: {
    primary: "emerald-600",
    primaryHover: "emerald-700",
    secondary: "slate-800",
    accent: "orange-500",
    background: "slate-50",
    surface: "white",
    text: "slate-900",
    textMuted: "slate-500",
  },
  logo: "https://picsum.photos/seed/logo/200/200",
  currency: "R$",
  categories: [
    { id: "lanches", label: "Lanches", icon: "burger" },
    { id: "pizza", label: "Pizzas", icon: "pizza" },
    { id: "bebidas", label: "Bebidas", icon: "cup-soda" },
  ]
};

export type ThemeConfig = typeof themeConfig;
