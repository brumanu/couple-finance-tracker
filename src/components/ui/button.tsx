import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-full border border-transparent bg-clip-padding font-heading text-sm font-normal tracking-normal whitespace-nowrap transition-all outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-45 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-accent-600 active:bg-accent-700",
        outline:
          "border-border bg-transparent text-foreground hover:bg-[color-mix(in_srgb,var(--foreground)_7%,transparent)] active:bg-[color-mix(in_srgb,var(--foreground)_14%,transparent)]",
        secondary:
          "border-border bg-transparent text-foreground hover:bg-[color-mix(in_srgb,var(--foreground)_7%,transparent)] active:bg-[color-mix(in_srgb,var(--foreground)_14%,transparent)]",
        ghost:
          "text-primary hover:bg-[color-mix(in_srgb,var(--organic-accent)_10%,transparent)] active:bg-[color-mix(in_srgb,var(--organic-accent)_18%,transparent)]",
        destructive:
          "text-destructive hover:bg-[color-mix(in_srgb,var(--destructive)_10%,transparent)] active:bg-[color-mix(in_srgb,var(--destructive)_18%,transparent)]",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-9 gap-2 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xs: "h-7 gap-1 px-2.5 text-xs has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 px-3 text-[0.8rem] has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-10 gap-2 px-5",
        icon: "size-9",
        "icon-xs": "size-7 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

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
  )
}

export { Button, buttonVariants }
