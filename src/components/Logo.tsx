import { cn } from "@/lib/cn";

/** Logo Victor Training. « lg » : logo complet (connexion) ; « md » : emblème + nom (menus). */
export function Logo({ size = "md", collapsed = false }: { size?: "md" | "lg"; collapsed?: boolean }) {
  if (size === "lg") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src="/logo-full.png" alt="Victor Training" width={900} height={830} className="h-auto w-[210px] select-none drop-shadow-[0_10px_40px_rgba(40,132,251,0.25)]" draggable={false} />
    );
  }
  return (
    <div className="flex items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-mark.png" alt="" width={480} height={348} className="h-9 w-auto select-none" draggable={false} />
      {!collapsed && (
        <div className="leading-none">
          <p className="font-display text-[19px] font-bold uppercase tracking-[0.14em] text-white">Victor</p>
          <p className={cn("mt-0.5 font-display text-[10.5px] font-semibold uppercase tracking-[0.42em] text-royal-500")}>Training</p>
        </div>
      )}
    </div>
  );
}
