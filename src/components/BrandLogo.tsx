import { cn } from "../utils/cn";

type BrandLogoSize = "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";

interface BrandLogoProps {
  className?: string;
  /**
   * - `light` → versão com texto branco, para usar sobre fundos escuros.
   * - `dark`  → versão com texto escuro, para usar sobre fundos claros.
   */
  variant?: "light" | "dark";
  size?: BrandLogoSize;
}

const sizeMap: Record<BrandLogoSize, string> = {
  sm: "h-7",
  md: "h-9",
  lg: "h-12",
  xl: "h-16",
  "2xl": "h-24",
  "3xl": "h-32",
};

export function BrandLogo({ className, variant = "dark", size = "md" }: BrandLogoProps) {
  const src = variant === "light" ? "/brand/logo-branco.png" : "/brand/logo-escuro.png";

  return (
    <img
      src={src}
      alt="KropFeet Sneakers"
      className={cn("w-auto select-none", sizeMap[size], className)}
      draggable={false}
    />
  );
}
