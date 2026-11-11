"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Tabs as TabsPrimitive } from "@animate-ui/react/primitives/radix-ui"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn("group/tabs flex gap-2 data-horizontal:flex-col", className)}
      {...props}
    />
  )
}

// "pill": muted track, white active tab with an xs shadow (day tabs, rankings, auth).
// "line": underline tabs with a count slot (series page).
const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center text-muted-foreground",
  {
    variants: {
      variant: {
        pill: "h-9 justify-center gap-0.5 rounded-lg bg-muted p-[3px]",
        line: "h-auto w-full justify-start gap-6 overflow-x-auto border-b bg-transparent p-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
      },
    },
    defaultVariants: { variant: "pill" },
  }
)

function TabsList({
  className,
  variant = "pill",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex items-center justify-center gap-1.5 text-sm font-medium whitespace-nowrap transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        // pill
        "group-data-[variant=pill]/tabs-list:h-[30px] group-data-[variant=pill]/tabs-list:flex-1 group-data-[variant=pill]/tabs-list:rounded-md group-data-[variant=pill]/tabs-list:px-3 group-data-[variant=pill]/tabs-list:data-active:bg-background group-data-[variant=pill]/tabs-list:data-active:text-foreground group-data-[variant=pill]/tabs-list:data-active:shadow-xs",
        // line
        "group-data-[variant=line]/tabs-list:-mb-px group-data-[variant=line]/tabs-list:rounded-sm group-data-[variant=line]/tabs-list:border-b-2 group-data-[variant=line]/tabs-list:border-transparent group-data-[variant=line]/tabs-list:pt-2 group-data-[variant=line]/tabs-list:pb-3 group-data-[variant=line]/tabs-list:data-active:border-foreground group-data-[variant=line]/tabs-list:data-active:text-foreground",
        className
      )}
      {...props}
    />
  )
}

/** Small count pill for the line variant: "Episodes [68]". */
function TabsCount({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="tabs-count"
      className={cn(
        "rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground tabular-nums",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 rounded-sm text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, TabsCount, tabsListVariants }
