import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// A comic panel you can press: ink border, hard offset shadow, and on `:active`
// the button travels into its own shadow rather than dimming. Nothing here is
// rounded — `--radius` is zero everywhere, so the shadcn utilities that ask for
// a radius all resolve to a square corner.
const buttonVariants = cva(
  "group/button font-display border-ink shadow-comic-sm active:shadow-none focus-visible:outline-hero-blue inline-flex shrink-0 cursor-pointer items-center justify-center border-2 leading-none tracking-wide whitespace-nowrap transition-[background-color,transform,box-shadow] duration-100 outline-none select-none focus-visible:outline-3 focus-visible:outline-offset-2 active:translate-x-[4px] active:translate-y-[4px] disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // Red is the publish colour: the action that puts something live.
        default: "bg-primary text-primary-foreground hover:bg-[#c81d22]",
        outline: "bg-card text-ink hover:bg-hero-yellow",
        secondary: "bg-hero-yellow text-ink hover:bg-card",
        ghost:
          "border-transparent shadow-none active:translate-0 hover:bg-hero-yellow text-ink",
        destructive: "bg-card text-hero-red hover:bg-hero-red hover:text-white",
        link: "border-transparent shadow-none active:translate-0 text-hero-blue underline decoration-2 underline-offset-4 hover:bg-hero-yellow hover:text-ink",
      },
      size: {
        default: "h-10 gap-2 px-4 pt-[3px] text-lg",
        xs: "h-7 gap-1 border-2 px-2 pt-[2px] text-xs shadow-comic-xs",
        sm: "h-8 gap-1.5 px-3 pt-[2px] text-base shadow-comic-xs",
        lg: "h-12 gap-2 border-3 px-6 pt-[3px] text-2xl shadow-comic",
        icon: "size-10",
        "icon-xs": "size-7 shadow-comic-xs",
        "icon-sm": "size-8 shadow-comic-xs",
        "icon-lg": "size-12 border-3 shadow-comic",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
