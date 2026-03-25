import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Home, AlertCircle } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="glass rounded-3xl p-10 max-w-md w-full text-center animate-page-in">
        <div className="mb-6 flex justify-center">
          <div className="p-4 rounded-2xl bg-destructive/10 text-destructive animate-float">
            <AlertCircle className="w-12 h-12" />
          </div>
        </div>
        
        <h1 className="mb-2 text-6xl font-black text-gradient">404</h1>
        <p className="mb-8 text-muted-foreground">
          Похоже, слой <code className="px-1.5 py-0.5 rounded bg-muted text-foreground">{location.pathname}</code> еще не создан.
        </p>
        
        <Link 
          to="/" 
          className="btn-gradient w-full py-4 rounded-2xl flex items-center justify-center gap-2 group"
        >
          <Home className="w-4 h-4 transition-transform group-hover:-translate-y-0.5" />
          Вернуться домой
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
