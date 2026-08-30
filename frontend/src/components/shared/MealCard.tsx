import { CookieIcon, SunriseIcon, UtensilsIcon } from "@/components/ui/icons";
import { MEAL_TYPE_LABELS } from "@/lib/labels";
import type { MealItem } from "@/lib/types";

const MEAL_VISUALS: Record<
  MealItem["mealType"],
  { icon: typeof SunriseIcon; badgeClassName: string; placeholderClassName: string }
> = {
  breakfast: {
    icon: SunriseIcon,
    badgeClassName: "bg-warning-tint text-warning",
    placeholderClassName: "bg-warning-tint text-warning",
  },
  lunch: {
    icon: UtensilsIcon,
    badgeClassName: "bg-brand-tint text-brand-dark",
    placeholderClassName: "bg-brand-tint text-brand-dark",
  },
  snack: {
    icon: CookieIcon,
    badgeClassName: "bg-info-tint text-info",
    placeholderClassName: "bg-info-tint text-info",
  },
};

export function MealCard({ meal }: { meal: MealItem }) {
  const { icon: MealIcon, badgeClassName, placeholderClassName } = MEAL_VISUALS[meal.mealType];

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className={`flex aspect-[16/9] items-center justify-center ${placeholderClassName}`}>
        {meal.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={meal.imageUrl}
            alt={meal.dishes[0] ?? MEAL_TYPE_LABELS[meal.mealType]}
            className="h-full w-full object-cover"
          />
        ) : (
          <MealIcon className="h-9 w-9 opacity-70" />
        )}
      </div>

      <div className="p-4">
        <div className="mb-2 flex items-center gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${badgeClassName}`}>
            <MealIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {MEAL_TYPE_LABELS[meal.mealType]}
            </p>
            <p className="text-xs text-foreground-muted">{meal.time}</p>
          </div>
        </div>
        <ul className="ml-1 list-disc space-y-0.5 pl-4 text-sm text-foreground-muted">
          {meal.dishes.map((dish) => (
            <li key={dish}>{dish}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
