import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { toast } from "sonner";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../components/ui/dropdown-menu";
import { Plus, FileText, MoreVertical, Copy, Trash2, Edit } from "lucide-react";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { useAuth } from "../context/AuthContext";


export default function Templates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await api.get(`/templates`);
      setTemplates(res.data);
    } catch (err) {
      toast.error("Fehler beim Laden der Templates");
    } finally {
      setLoading(false);
    }
  };

  const duplicateTemplate = async (id) => {
    try {
      await api.post(`/templates/${id}/duplicate`);
      toast.success("Template dupliziert");
      fetchTemplates();
    } catch (err) {
      toast.error("Fehler beim Duplizieren");
    }
  };

  const deleteTemplate = async (id) => {
    if (!window.confirm("Template wirklich löschen?")) return;
    try {
      await api.delete(`/templates/${id}`);
      toast.success("Template gelöscht");
      fetchTemplates();
    } catch (err) {
      toast.error("Fehler beim Löschen");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="templates-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Templates</h1>
          <p className="text-slate-500 mt-1">Vorlagen für verschiedene Rollen</p>
        </div>
        {isAdmin && (
          <Button onClick={() => navigate("/templates/new")} className="btn-primary gap-2" data-testid="new-template">
            <Plus className="w-4 h-4" /> Neues Template
          </Button>
        )}
      </div>

      {templates.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="w-16 h-16 text-slate-300 mb-4" />
            <h3 className="text-xl font-semibold text-slate-700 mb-2">Keine Templates vorhanden</h3>
            <p className="text-slate-500 mb-6">Erstellen Sie Ihr erstes Template oder laden Sie die Seed-Daten</p>
            {isAdmin && (
              <div className="flex gap-3">
                <Button onClick={() => navigate("/templates/new")} className="btn-primary">
                  Template erstellen
                </Button>
                <Button variant="outline" onClick={async () => {
                  try {
                    await api.post(`/seed`);
                    toast.success("Seed-Daten geladen!");
                    fetchTemplates();
                  } catch (err) {
                    toast.error("Fehler beim Laden der Seed-Daten");
                  }
                }} data-testid="seed-data">
                  Beispieldaten laden
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map(template => (
            <Card key={template.id} className="card-hover cursor-pointer" onClick={() => navigate(`/templates/${template.id}`)} data-testid={`template-${template.id}`}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">{template.name}</h3>
                      <p className="text-sm text-slate-500">{template.tasks.length} Tasks</p>
                    </div>
                  </div>
                  {isAdmin && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/templates/${template.id}`); }}>
                          <Edit className="w-4 h-4 mr-2" /> Bearbeiten
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); duplicateTemplate(template.id); }}>
                          <Copy className="w-4 h-4 mr-2" /> Duplizieren
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); deleteTemplate(template.id); }} className="text-red-600">
                          <Trash2 className="w-4 h-4 mr-2" /> Löschen
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                
                {template.description && (
                  <p className="text-sm text-slate-500 mt-3 line-clamp-2">{template.description}</p>
                )}

                <div className="flex flex-wrap gap-2 mt-4">
                  {[...new Set(template.tasks.map(t => t.category))].slice(0, 3).map(cat => (
                    <Badge key={cat} variant="secondary" className="text-xs">{cat}</Badge>
                  ))}
                </div>

                <p className="text-xs text-slate-400 mt-4">
                  Aktualisiert: {format(parseISO(template.updated_at), "dd. MMM yyyy", { locale: de })}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
