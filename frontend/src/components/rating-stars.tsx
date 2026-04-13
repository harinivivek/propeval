"use client";

import { cn } from "@/lib/utils";

interface RatingStarsProps {
  rating: number | null;
  maxStars?: number;
  size?: "sm" | "md" | "lg";
  interactive?: boolean;
  onChange?: (rating: number) => void;
  className?: string;
  showValue?: boolean;
  count?: number;
}

export function RatingStars({
  rating,
  maxStars = 5,
  size = "md",
  interactive = false,
  onChange,
  className,
  showValue = false,
  count,
}: RatingStarsProps) {
  const sizeClasses = {
    sm: "text-sm",
    md: "text-lg",
    lg: "text-2xl",
  };

  const currentRating = rating ?? 0;

  return (
    <div className={cn("inline-flex items-center gap-1", className)}>
      <div className="flex">
        {Array.from({ length: maxStars }, (_, i) => {
          const starValue = i + 1;
          const filled = starValue <= Math.round(currentRating);

          return (
            <button
              key={i}
              type="button"
              disabled={!interactive}
              onClick={() => interactive && onChange?.(starValue)}
              className={cn(
                sizeClasses[size],
                interactive ? "cursor-pointer hover:scale-110 transition-transform" : "cursor-default",
                filled ? "text-amber-400" : "text-muted-foreground/30"
              )}
            >
              {"\u2605"}
            </button>
          );
        })}
      </div>
      {showValue && rating !== null && (
        <span className="text-sm text-muted-foreground ml-1">
          {rating.toFixed(1)}
          {count !== undefined && ` (${count})`}
        </span>
      )}
    </div>
  );
}
