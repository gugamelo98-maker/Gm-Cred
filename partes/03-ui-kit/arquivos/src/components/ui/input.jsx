
import React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-md border border-violet-600 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-600 focus:ring-offset-1 focus:border-violet-600 disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-gray-100",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
