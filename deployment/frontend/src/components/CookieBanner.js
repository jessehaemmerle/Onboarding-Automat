import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Cookie, Shield, X } from "lucide-react";

export default function CookieBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Check if user has already consented
    const consent = localStorage.getItem("cookie_consent");
    if (!consent) {
      setShow(true);
    }
  }, []);

  const acceptCookies = () => {
    localStorage.setItem("cookie_consent", JSON.stringify({
      necessary: true,
      accepted_at: new Date().toISOString()
    }));
    setShow(false);
  };

  const declineCookies = () => {
    localStorage.setItem("cookie_consent", JSON.stringify({
      necessary: true,
      declined_at: new Date().toISOString()
    }));
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
          <div className="flex items-start gap-3 flex-1">
            <Cookie className="w-6 h-6 text-amber-500 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-semibold text-slate-900">Cookie-Hinweis</h3>
              <p className="text-sm text-slate-600 mt-1">
                Diese Website verwendet ausschließlich <strong>technisch notwendige Cookies</strong> für die 
                Anmeldefunktion und Sicherheit. Es werden keine Tracking- oder Werbe-Cookies verwendet.
              </p>
              <a href="/datenschutz" className="text-sm text-blue-600 hover:underline mt-1 inline-block">
                Mehr erfahren →
              </a>
            </div>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <Button variant="outline" size="sm" onClick={declineCookies} className="flex-1 md:flex-none">
              Nur notwendige
            </Button>
            <Button size="sm" onClick={acceptCookies} className="flex-1 md:flex-none">
              <Shield className="w-4 h-4 mr-2" />
              Akzeptieren
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
