import Link from 'next/link';
import { Bus, Cog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export default function Header() {
  return (
    <header className="bg-card border-b sticky top-0 z-10">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center gap-3">
            <div className="bg-primary text-primary-foreground p-2 rounded-lg">
              <Bus className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-bold text-foreground font-headline">eTransport</h1>
          </Link>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button asChild variant="ghost" size="icon">
                  <Link href="/admin">
                    <Cog className="h-5 w-5" />
                    <span className="sr-only">Administravimas</span>
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Administravimo panelė</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </header>
  );
}
