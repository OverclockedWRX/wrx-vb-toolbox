import { Button } from "@/components/ui/button";

const STORAGE_KEY = "vb-wrx-theme";

export function ThemeToggle() {
  function toggle() {
    const next = document.documentElement.classList.contains("dark") ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    document.documentElement.style.colorScheme = next;
    localStorage.setItem(STORAGE_KEY, next);
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={toggle} aria-label="Toggle dark mode" className="shrink-0">
      <span className="dark:hidden">Dark mode</span>
      <span className="hidden dark:inline">Light mode</span>
    </Button>
  );
}
