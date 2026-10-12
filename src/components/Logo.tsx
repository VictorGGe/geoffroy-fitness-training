import { cn } from "./ui";

export function Logo({ size = "md", collapsed = false }: { size?: "md" | "lg"; collapsed?: boolean }) {
  const big = size === "lg";
  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          "relative flex items-center justify-center rounded-xl bg-gradient-to-br from-royal-500 to-royal-700 font-display font-bold text-white shadow-glow",
          big ? "h-12 w-12 text-2xl" : "h-9 w-9 text-lg",
        )}
      >
        GF
      </div>
      {!collapsed && (
        <div className="leading-none">
          <p className={cn("font-display font-bold uppercase tracking-[0.08em] text-white", big ? "text-2xl" : "text-[17px]")}>
            Geoffroy
          </p>
          <p className={cn("font-display font-medium uppercase tracking-[0.22em] text-royal-400", big ? "mt-1 text-[13px]" : "mt-0.5 text-[10.5px]")}>
            Fitness Training
          </p>
        </div>
      )}
    </div>
  );
}
