import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2.5 text-[11px] font-medium tracking-wide whitespace-nowrap transition-all focus-visible:ring-2 focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-accent-100 text-accent-800 [a]:hover:bg-accent-200",
        secondary: "bg-sage-200 text-sage-800 [a]:hover:bg-sage-300",
        destructive:
          "bg-accent-200 text-accent-800 [a]:hover:bg-accent-300",
        outline:
          "border-primary text-primary [a]:hover:bg-accent-100",
        neutral: "bg-neutral-200 text-neutral-800 [a]:hover:bg-neutral-300",
        ghost: "text-foreground hover:bg-neutral-200",
        link: "text-primary underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
