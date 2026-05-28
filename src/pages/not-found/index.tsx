import { Link } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="text-center">
        <div className="text-8xl font-extrabold text-primary/20 mb-4">404</div>
        <h1 className="text-2xl font-bold mb-2">Page Not Found</h1>
        <p className="text-muted-foreground mb-8 max-w-sm mx-auto">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/terminal"
            className={cn(
              buttonVariants({ variant: "default", size: "lg" }),
              "rounded-xl px-8 font-bold shadow-lg shadow-primary/20"
            )}
          >
            <Home className="h-4 w-4 mr-2" />
            Go to Terminal
          </Link>
          <Link
            to="/"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "rounded-xl px-8 font-bold"
            )}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
