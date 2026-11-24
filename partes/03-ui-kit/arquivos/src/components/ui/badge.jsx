
import * as React from "react"
import { cva } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-violet-600 text-white hover:bg-violet-700",
        secondary:
          "border-transparent bg-violet-100 text-violet-800 hover:bg-violet-200",
        destructive:
          "border-transparent bg-red-500 text-white hover:bg-red-600",
        outline: "text-foreground border-violet-200",
        success: "border-transparent bg-green-500 text-white hover:bg-green-600",
        warning: "border-transparent bg-yellow-400 text-yellow-900 hover:bg-yellow-500",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({ className, variant, ...props }) {
  return (<div className={cn(badgeVariants({ variant }), className)} {...props} />);
}

export { Badge, badgeVariants }
