"use client"

import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"

import { cn } from "@/lib/utils"

const Popover = PopoverPrimitive.Root

const PopoverTrigger = PopoverPrimitive.Trigger

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content> & {
    anchorRef?: React.RefObject<HTMLElement>
  }
>(({ className, align = "center", sideOffset = 4, anchorRef, ...props }, ref) => {
  const content = (
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      {...props}
    />
  )

  if (anchorRef) {
    return (
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Anchor asChild>
          <div
            style={{
              position: 'absolute',
              top: anchorRef.current?.getBoundingClientRect().bottom,
              left: anchorRef.current?.getBoundingClientRect().left,
              width: anchorRef.current?.getBoundingClientRect().width,
            }}
          />
        </PopoverPrimitive.Anchor>
        {content}
      </PopoverPrimitive.Portal>
    )
  }

  return (
    <PopoverPrimitive.Portal>
      {content}
    </PopoverPrimitive.Portal>
  )
})
PopoverContent.displayName = PopoverPrimitive.Content.displayName

export { Popover, PopoverTrigger, PopoverContent }
