import { useState } from "react";
import api from "../lib/api";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { CheckCircle2, ArrowRight, Users, Tags, Building2, Sparkles } from "lucide-react";

const STEPS = [
  { id: "welcome",    title: "Willkommen bei Welkora", icon: Sparkles },
  { id: "role",       title: "Erste Rolle anlegen",       icon: Users },
  { id: "category",   title: "Erste Kategorie anlegen",   icon: Tags },
  { id: "done",       title: "Fertig!",                   icon: CheckCircle2 },
];

const ROLE_SUGGESTIONS   = ["IT", "HR", "Manager", "Sicherheit", "Buchhaltung"];
const CATEGORY_SUGGESTIONS = ["IT", "HR", "Legal", "Sicherheit", "Facility", "Finanzen"];

export default function OnboardingWizard({ open, onClose }) {
  const [step, setStep] = useState(0);
  const [roleName, setRoleName] = useState("");
  const [roleEmail, setRoleEmail] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const handleRole = async () => {
    if (!roleName.trim()) { toast.error("Bitte einen Rollennamen eingeben"); return; }
    setSaving(true);
    try {
      await api.post("/owner-roles", { name: roleName, emails: roleEmail ? [roleEmail] : [] });
      toast.success(`Rolle "${roleName}" erstellt`);
      setStep(2);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Fehler beim Erstellen der Rolle");
    } finally {
      setSaving(false);
    }
  };

  const handleCategory = async () => {
    if (!categoryName.trim()) { toast.error("Bitte einen Kategorienamen eingeben"); return; }
    setSaving(true);
    try {
      await api.post("/categories", { name: categoryName, color: "#3b82f6" });
      toast.success(`Kategorie "${categoryName}" erstellt`);
      setStep(3);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Fehler beim Erstellen der Kategorie");
    } finally {
      setSaving(false);
    }
  };

  const handleFinish = () => {
    localStorage.setItem("wizard_done", "1");
    onClose();
    navigate("/templates/new");
  };

  const handleSkip = () => {
    localStorage.setItem("wizard_done", "1");
    onClose();
  };

  const stepPct = Math.round((step / (STEPS.length - 1)) * 100);

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-lg" onInteractOutside={e => e.preventDefault()}>
        {/* Progress */}
        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-2">
          <div
            className="h-full bg-blue-600 rounded-full transition-all duration-500"
            style={{ width: `${stepPct}%` }}
          />
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-between mb-6">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const done = i < step;
            const active = i === step;
            return (
              <div key={s.id} className="flex flex-col items-center gap-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                  done ? "bg-emerald-100 text-emerald-600" : active ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-400"
                }`}>
                  {done ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </div>
                <span className={`text-xs hidden sm:block ${active ? "text-slate-700 font-medium" : "text-slate-400"}`}>
                  {i + 1}
                </span>
              </div>
            );
          })}
        </div>

        {/* Step content */}
        {step === 0 && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-600" /> Willkommen bei Welkora!
              </DialogTitle>
              <DialogDescription>
                Lassen Sie uns in 2 Minuten Ihre Organisation einrichten. Dieser Wizard hilft Ihnen, die ersten Rollen und Kategorien anzulegen.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              {[
                { icon: Users, label: "Rollen anlegen (z.B. IT, HR)" },
                { icon: Tags, label: "Kategorien für Tasks definieren" },
                { icon: Building2, label: "Erstes Onboarding-Template erstellen" },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                  <Icon className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="text-sm text-slate-700">{label}</span>
                </div>
              ))}
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="ghost" onClick={handleSkip} className="text-slate-500">Überspringen</Button>
              <Button onClick={() => setStep(1)} className="btn-primary">
                Los geht's <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 1 && (
          <>
            <DialogHeader>
              <DialogTitle>Erste Rolle anlegen</DialogTitle>
              <DialogDescription>
                Rollen entsprechen Verantwortlichen für Tasks (z.B. "IT" oder "HR Manager").
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="flex flex-wrap gap-2">
                {ROLE_SUGGESTIONS.map(s => (
                  <Badge
                    key={s}
                    variant="outline"
                    className="cursor-pointer hover:bg-blue-50 hover:border-blue-400"
                    onClick={() => setRoleName(s)}
                  >
                    {s}
                  </Badge>
                ))}
              </div>
              <div className="space-y-2">
                <Label>Rollenname *</Label>
                <Input
                  placeholder="z.B. IT"
                  value={roleName}
                  onChange={e => setRoleName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleRole()}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label>E-Mail (optional)</Label>
                <Input
                  type="email"
                  placeholder="it@firmaname.at"
                  value={roleEmail}
                  onChange={e => setRoleEmail(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="ghost" onClick={() => setStep(2)} className="text-slate-500">Überspringen</Button>
              <Button onClick={handleRole} disabled={saving} className="btn-primary">
                Anlegen <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 2 && (
          <>
            <DialogHeader>
              <DialogTitle>Erste Kategorie anlegen</DialogTitle>
              <DialogDescription>
                Kategorien gruppieren Tasks in Templates (z.B. "IT", "Legal", "HR").
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="flex flex-wrap gap-2">
                {CATEGORY_SUGGESTIONS.map(s => (
                  <Badge
                    key={s}
                    variant="outline"
                    className="cursor-pointer hover:bg-blue-50 hover:border-blue-400"
                    onClick={() => setCategoryName(s)}
                  >
                    {s}
                  </Badge>
                ))}
              </div>
              <div className="space-y-2">
                <Label>Kategoriename *</Label>
                <Input
                  placeholder="z.B. IT"
                  value={categoryName}
                  onChange={e => setCategoryName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleCategory()}
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="ghost" onClick={() => setStep(3)} className="text-slate-500">Überspringen</Button>
              <Button onClick={handleCategory} disabled={saving} className="btn-primary">
                Anlegen <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 3 && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" /> Einrichtung abgeschlossen!
              </DialogTitle>
              <DialogDescription>
                Ihre Organisation ist bereit. Erstellen Sie jetzt Ihr erstes Onboarding-Template.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <p className="text-slate-600 text-sm">Weiter geht's mit dem Template-Editor — definieren Sie dort die Tasks für Ihr Onboarding.</p>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="ghost" onClick={handleSkip}>Später</Button>
              <Button onClick={handleFinish} className="btn-primary">
                Template erstellen <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
