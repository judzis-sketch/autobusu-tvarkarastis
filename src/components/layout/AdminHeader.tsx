import Link from 'next/link';
import { ArrowLeft, Cog } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AdminHeader() {
  return (
    <header className="bg-card border-b sticky top-0 z-10">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-4">
            <Button asChild variant="outline" size="icon">
              <Link href="/">
                <ArrowLeft className="h-4 w-4" />
                <span className="sr-only">Grįžti</span>
              </Link>
            </Button>
            <div className="flex items-center gap-2">
              <Cog className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold text-foreground font-headline">Administravimas</h1>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
