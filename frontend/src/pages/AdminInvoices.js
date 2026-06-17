import { useState, useEffect, useCallback } from "react";
import api from "../lib/api";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import {
  Receipt, Plus, Send, Download, CheckCircle, Ban, Loader2,
  Settings as SettingsIcon, Trash2, FileText, RefreshCw,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { calculatePrice, formatEuro, usePricing } from "../lib/pricing";

const EU_COUNTRIES = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR",
  "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK",
  "SI", "ES", "SE",
]);

const fmtEur = (n) =>
  new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR" }).format(Number(n || 0));

const emptyRecipient = { company_name: "", address_line: "", zip: "", city: "", country: "AT", uid: "", email: "", contact_name: "" };

const STATUS = {
  draft: { label: "Entwurf", cls: "bg-slate-200 text-slate-700" },
  sent: { label: "Versendet", cls: "bg-blue-100 text-blue-700" },
  paid: { label: "Bezahlt", cls: "bg-green-100 text-green-700" },
  canceled: { label: "Storniert", cls: "bg-red-100 text-red-700" },
};

const TREATMENT_LABEL = {
  standard: "20% USt (Inland)",
  reverse_charge: "Reverse Charge (EU, UID)",
  small_business: "Kleinunternehmer (steuerfrei)",
  not_taxable: "Nicht steuerbar (Drittland)",
};

export default function AdminInvoices() {
  const { isSuperAdmin } = useAuth();
  const { config: pricingConfig } = usePricing();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState(null);
  const [orgs, setOrgs] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [filterOrg, setFilterOrg] = useState("all");

  // Create dialog
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    organization_id: "", issue_date: "", service_period_start: "", service_period_end: "",
    due_days: 14, notes: "", tax_treatment: "auto",
  });
  const [recipient, setRecipient] = useState(emptyRecipient);
  const [lineItems, setLineItems] = useState([{ description: "", quantity: 1, unit_price_net: 0 }]);
  // License price calculator (mirrors the landing-page pricing model)
  const [licenseUsers, setLicenseUsers] = useState(0);
  const [billingCycle, setBillingCycle] = useState("monthly");

  useEffect(() => {
    if (!isSuperAdmin) { navigate("/admin/login"); return; }
    fetchAll();
  }, [isSuperAdmin, navigate]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [s, o, i] = await Promise.all([
        api.get("/admin/billing-settings"),
        api.get("/admin/organizations"),
        api.get("/admin/invoices"),
      ]);
      setSettings(s.data);
      setOrgs(o.data);
      setInvoices(i.data);
    } catch {
      toast.error("Fehler beim Laden der Rechnungsdaten");
    } finally {
      setLoading(false);
    }
  };

  const fetchInvoices = async () => {
    const i = await api.get("/admin/invoices");
    setInvoices(i.data);
  };

  // ---------- Settings ----------
  const saveSettings = async () => {
    try {
      await api.put("/admin/billing-settings", settings);
      toast.success("Rechnungs-Einstellungen gespeichert");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Fehler beim Speichern");
    }
  };
  const sf = (k) => (e) => setSettings({ ...settings, [k]: e.target.value });

  // ---------- Tax preview ----------
  const resolveTreatment = useCallback(() => {
    if (form.tax_treatment !== "auto") return form.tax_treatment;
    if (settings?.tax_mode === "small_business") return "small_business";
    const seller = (settings?.country || "AT").toUpperCase();
    const rc = (recipient.country || "AT").toUpperCase();
    if (rc === seller) return "standard";
    if (EU_COUNTRIES.has(rc)) return recipient.uid ? "reverse_charge" : "standard";
    return "not_taxable";
  }, [form.tax_treatment, recipient, settings]);

  const net = lineItems.reduce((sum, li) => sum + Number(li.quantity || 0) * Number(li.unit_price_net || 0), 0);
  const treatment = resolveTreatment();
  const vatRate = treatment === "standard" ? Number(settings?.vat_rate ?? 20) : 0;
  const vat = (net * vatRate) / 100;
  const gross = net + vat;

  // ---------- Create dialog ----------
  const openCreate = async () => {
    setForm({ organization_id: "", issue_date: "", service_period_start: "", service_period_end: "", due_days: settings?.payment_terms_days || 14, notes: "", tax_treatment: "auto" });
    setRecipient(emptyRecipient);
    setLineItems([{ description: "", quantity: 1, unit_price_net: 0 }]);
    setLicenseUsers(0);
    setBillingCycle("monthly");
    setShowCreate(true);
  };

  const onSelectOrg = async (orgId) => {
    setForm((f) => ({ ...f, organization_id: orgId }));
    try {
      const { data } = await api.get(`/admin/organizations/${orgId}/invoice-defaults`);
      const org = orgs.find((o) => o.id === orgId);
      const rec = data.recipient && data.recipient.company_name
        ? { ...emptyRecipient, ...data.recipient }
        : { ...emptyRecipient, company_name: org?.name || "" };
      setRecipient(rec);
      setLineItems(data.line_items?.length ? data.line_items : [{ description: "", quantity: 1, unit_price_net: 0 }]);
      setLicenseUsers(data.license_users || data.user_count || 0);
      setBillingCycle(data.billing_cycle || "monthly");
      setForm((f) => ({
        ...f,
        issue_date: data.issue_date || "",
        service_period_start: data.service_period_start || "",
        due_days: data.due_days ?? f.due_days,
      }));
    } catch {
      toast.error("Konnte Vorschlagswerte nicht laden");
    }
  };

  // Live license price from the shared pricing model (backend config)
  const licenseCalc = calculatePrice(licenseUsers || 1, pricingConfig);
  const licenseAmount = billingCycle === "yearly" ? licenseCalc.annual : licenseCalc.monthly;

  const applyLicenseLine = () => {
    const periodLabel = billingCycle === "yearly" ? "Jahr" : "Monat";
    setLineItems([{
      description: `Welkora Lizenz – ${licenseCalc.users} Benutzer · ${formatEuro(licenseCalc.perUser)}/Benutzer (${periodLabel})`,
      quantity: 1,
      unit_price_net: licenseAmount,
    }]);
    toast.success("Lizenz-Position übernommen");
  };

  const updateLine = (idx, key, value) => {
    setLineItems((items) => items.map((li, i) => (i === idx ? { ...li, [key]: value } : li)));
  };
  const addLine = () => setLineItems((i) => [...i, { description: "", quantity: 1, unit_price_net: 0 }]);
  const removeLine = (idx) => setLineItems((i) => i.filter((_, x) => x !== idx));

  const submitInvoice = async (send) => {
    if (!form.organization_id) { toast.error("Bitte Organisation wählen"); return; }
    if (!recipient.company_name || !recipient.address_line || !recipient.zip || !recipient.city) {
      toast.error("Bitte Empfänger-Rechnungsdaten vollständig ausfüllen");
      return;
    }
    if (!lineItems.length || lineItems.some((li) => !li.description || Number(li.unit_price_net) <= 0)) {
      toast.error("Bitte alle Positionen mit Bezeichnung und Preis ausfüllen");
      return;
    }
    setCreating(true);
    try {
      // persist recipient billing data first
      await api.put(`/admin/organizations/${form.organization_id}/billing`, recipient);
      await api.post("/admin/invoices", {
        organization_id: form.organization_id,
        issue_date: form.issue_date || null,
        service_period_start: form.service_period_start || null,
        service_period_end: form.service_period_end || null,
        due_days: Number(form.due_days),
        line_items: lineItems.map((li) => ({
          description: li.description,
          quantity: Number(li.quantity),
          unit_price_net: Number(li.unit_price_net),
        })),
        tax_treatment: form.tax_treatment === "auto" ? null : form.tax_treatment,
        notes: form.notes,
        send,
      });
      toast.success(send ? "Rechnung erstellt und versendet" : "Rechnung als Entwurf erstellt");
      setShowCreate(false);
      fetchInvoices();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Fehler beim Erstellen der Rechnung");
    } finally {
      setCreating(false);
    }
  };

  // ---------- Invoice actions ----------
  const downloadPdf = async (inv) => {
    try {
      const res = await api.get(`/admin/invoices/${inv.id}/pdf`, { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      toast.error("PDF konnte nicht erzeugt werden");
    }
  };
  const sendInvoice = async (inv) => {
    try {
      await api.post(`/admin/invoices/${inv.id}/send`);
      toast.success(`Rechnung ${inv.invoice_number} versendet`);
      fetchInvoices();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Versand fehlgeschlagen");
    }
  };
  const markPaid = async (inv) => {
    await api.post(`/admin/invoices/${inv.id}/mark-paid`);
    toast.success("Als bezahlt markiert");
    fetchInvoices();
  };
  const cancelInvoice = async (inv) => {
    if (!window.confirm(`Rechnung ${inv.invoice_number} stornieren?`)) return;
    await api.post(`/admin/invoices/${inv.id}/cancel`);
    toast.success("Rechnung storniert");
    fetchInvoices();
  };

  const shownInvoices = filterOrg === "all" ? invoices : invoices.filter((i) => i.organization_id === filterOrg);

  if (!settings) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-purple-400" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Receipt className="w-7 h-7 text-purple-400" /> Rechnungen
          </h1>
          <p className="text-slate-400 mt-1">Österreichische B2B-Rechnungen erstellen und per E-Mail versenden</p>
        </div>
        <Button onClick={fetchAll} variant="outline" disabled={loading} className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Aktualisieren
        </Button>
      </div>

      <Tabs defaultValue="invoices" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="invoices">Rechnungen</TabsTrigger>
          <TabsTrigger value="settings">Einstellungen</TabsTrigger>
        </TabsList>

        {/* ---------------- Invoices ---------------- */}
        <TabsContent value="invoices" className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="w-72">
              <Select value={filterOrg} onValueChange={setFilterOrg}>
                <SelectTrigger><SelectValue placeholder="Organisation filtern" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Organisationen</SelectItem>
                  {orgs.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" /> Neue Rechnung</Button>
          </div>

          <Card>
            <CardContent className="p-0">
              {shownInvoices.length === 0 ? (
                <p className="text-center text-slate-500 py-12">Noch keine Rechnungen vorhanden.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-slate-500">
                      <th className="p-3">Nummer</th>
                      <th className="p-3">Organisation</th>
                      <th className="p-3">Datum</th>
                      <th className="p-3 text-right">Betrag</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Aktionen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shownInvoices.map((inv) => (
                      <tr key={inv.id} className="border-b last:border-0 hover:bg-slate-50">
                        <td className="p-3 font-mono font-medium">{inv.invoice_number}</td>
                        <td className="p-3">{inv.organization_name}</td>
                        <td className="p-3">{inv.issue_date}</td>
                        <td className="p-3 text-right font-medium">{fmtEur(inv.gross_total)}</td>
                        <td className="p-3">
                          <Badge className={STATUS[inv.status]?.cls}>{STATUS[inv.status]?.label || inv.status}</Badge>
                        </td>
                        <td className="p-3">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" title="PDF" onClick={() => downloadPdf(inv)}>
                              <Download className="w-4 h-4" />
                            </Button>
                            {inv.status !== "canceled" && (
                              <Button size="icon" variant="ghost" title={inv.status === "sent" ? "Erneut senden" : "Senden"} onClick={() => sendInvoice(inv)}>
                                <Send className="w-4 h-4 text-blue-600" />
                              </Button>
                            )}
                            {inv.status !== "paid" && inv.status !== "canceled" && (
                              <Button size="icon" variant="ghost" title="Als bezahlt" onClick={() => markPaid(inv)}>
                                <CheckCircle className="w-4 h-4 text-green-600" />
                              </Button>
                            )}
                            {inv.status !== "canceled" && (
                              <Button size="icon" variant="ghost" title="Stornieren" onClick={() => cancelInvoice(inv)}>
                                <Ban className="w-4 h-4 text-red-600" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------- Settings ---------------- */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><SettingsIcon className="w-5 h-5 text-blue-600" /> Aussteller / Rechnungs-Einstellungen</CardTitle>
              <CardDescription>Diese Daten erscheinen auf jeder Rechnung. Pflichtangaben gem. § 11 UStG.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <Field label="Firmenname *"><Input value={settings.company_name} onChange={sf("company_name")} /></Field>
                <Field label="UID-Nummer (ATU…) *"><Input value={settings.uid} onChange={sf("uid")} placeholder="ATU12345678" /></Field>
                <Field label="Adresse *"><Input value={settings.address_line} onChange={sf("address_line")} /></Field>
                <div className="grid grid-cols-3 gap-2">
                  <Field label="PLZ *"><Input value={settings.zip} onChange={sf("zip")} /></Field>
                  <Field label="Ort *"><Input value={settings.city} onChange={sf("city")} /></Field>
                  <Field label="Land"><Input value={settings.country} onChange={sf("country")} maxLength={2} /></Field>
                </div>
                <Field label="E-Mail"><Input value={settings.email} onChange={sf("email")} /></Field>
                <Field label="Telefon"><Input value={settings.phone} onChange={sf("phone")} /></Field>
                <Field label="IBAN"><Input value={settings.iban} onChange={sf("iban")} /></Field>
                <Field label="BIC"><Input value={settings.bic} onChange={sf("bic")} /></Field>
                <Field label="Bank"><Input value={settings.bank_name} onChange={sf("bank_name")} /></Field>
                <Field label="Firmenbuchnummer"><Input value={settings.firmenbuch_nr} onChange={sf("firmenbuch_nr")} placeholder="FN 123456a" /></Field>
                <Field label="Firmenbuchgericht"><Input value={settings.firmenbuch_gericht} onChange={sf("firmenbuch_gericht")} /></Field>
                <Field label="Rechnungsnummer-Präfix"><Input value={settings.invoice_prefix} onChange={sf("invoice_prefix")} placeholder="z.B. WK" /></Field>
                <Field label="USt-Satz (%)"><Input type="number" value={settings.vat_rate} onChange={sf("vat_rate")} /></Field>
                <Field label="Zahlungsziel (Tage)"><Input type="number" value={settings.payment_terms_days} onChange={sf("payment_terms_days")} /></Field>
                <Field label="Steuermodus">
                  <Select value={settings.tax_mode} onValueChange={(v) => setSettings({ ...settings, tax_mode: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Regelbesteuerung (20% USt)</SelectItem>
                      <SelectItem value="small_business">Kleinunternehmer (steuerfrei)</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field label="Fußzeile / Hinweis (optional)">
                <Textarea value={settings.footer_note} onChange={sf("footer_note")} rows={2} />
              </Field>
              <div className="flex justify-end">
                <Button onClick={saveSettings}>Einstellungen speichern</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ---------------- Create Invoice Dialog ---------------- */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileText className="w-5 h-5 text-blue-600" /> Neue Rechnung</DialogTitle>
            <DialogDescription>Lizenz-Vorschlag wird automatisch geladen und kann angepasst werden.</DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Organisation */}
            <Field label="Organisation *">
              <Select value={form.organization_id} onValueChange={onSelectOrg}>
                <SelectTrigger><SelectValue placeholder="Organisation wählen" /></SelectTrigger>
                <SelectContent>
                  {orgs.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>

            {form.organization_id && (
              <>
                {/* Recipient */}
                <div className="border rounded-lg p-4 space-y-3 bg-slate-50">
                  <p className="text-sm font-semibold text-slate-700">Rechnungsempfänger</p>
                  <div className="grid md:grid-cols-2 gap-3">
                    <Field label="Firmenname *"><Input value={recipient.company_name} onChange={(e) => setRecipient({ ...recipient, company_name: e.target.value })} /></Field>
                    <Field label="UID-Nummer (für Reverse Charge)"><Input value={recipient.uid} onChange={(e) => setRecipient({ ...recipient, uid: e.target.value })} /></Field>
                    <Field label="Adresse *"><Input value={recipient.address_line} onChange={(e) => setRecipient({ ...recipient, address_line: e.target.value })} /></Field>
                    <div className="grid grid-cols-3 gap-2">
                      <Field label="PLZ *"><Input value={recipient.zip} onChange={(e) => setRecipient({ ...recipient, zip: e.target.value })} /></Field>
                      <Field label="Ort *"><Input value={recipient.city} onChange={(e) => setRecipient({ ...recipient, city: e.target.value })} /></Field>
                      <Field label="Land"><Input value={recipient.country} maxLength={2} onChange={(e) => setRecipient({ ...recipient, country: e.target.value.toUpperCase() })} /></Field>
                    </div>
                    <Field label="E-Mail (Empfänger)"><Input value={recipient.email} onChange={(e) => setRecipient({ ...recipient, email: e.target.value })} /></Field>
                  </div>
                </div>

                {/* License price calculator (landing-page model) */}
                <div className="border rounded-lg p-4 bg-blue-50/50 space-y-3">
                  <p className="text-sm font-semibold text-slate-700">Lizenz-Preisrechner</p>
                  <div className="grid sm:grid-cols-3 gap-3 items-end">
                    <Field label="Anzahl Benutzer">
                      <Input
                        type="number"
                        min="1"
                        value={licenseUsers}
                        onChange={(e) => setLicenseUsers(parseInt(e.target.value, 10) || 0)}
                      />
                    </Field>
                    <Field label="Abrechnung">
                      <Select value={billingCycle} onValueChange={setBillingCycle}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly">Monatlich</SelectItem>
                          <SelectItem value="yearly">Jährlich (2 Monate gratis)</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-slate-900">{formatEuro(licenseAmount)}</p>
                      <p className="text-xs text-slate-500">
                        {formatEuro(licenseCalc.perUser)}/Benutzer · {billingCycle === "yearly" ? "pro Jahr" : "pro Monat"}
                      </p>
                    </div>
                  </div>
                  {licenseCalc.isEnterprise && (
                    <p className="text-xs text-amber-700">Über 250 Benutzer – ggf. individuelles Angebot prüfen.</p>
                  )}
                  <Button type="button" variant="outline" size="sm" onClick={applyLicenseLine}>
                    Als Rechnungsposition übernehmen
                  </Button>
                </div>

                {/* Line items */}
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-slate-700">Positionen (Nettopreise)</p>
                  {lineItems.map((li, idx) => (
                    <div key={idx} className="flex gap-2 items-start">
                      <Input className="flex-1" placeholder="Bezeichnung" value={li.description} onChange={(e) => updateLine(idx, "description", e.target.value)} />
                      <Input className="w-20" type="number" min="0" step="0.5" placeholder="Menge" value={li.quantity} onChange={(e) => updateLine(idx, "quantity", e.target.value)} />
                      <Input className="w-28" type="number" min="0" step="0.01" placeholder="€ netto" value={li.unit_price_net} onChange={(e) => updateLine(idx, "unit_price_net", e.target.value)} />
                      <Button variant="ghost" size="icon" onClick={() => removeLine(idx)} disabled={lineItems.length === 1}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={addLine}><Plus className="w-4 h-4 mr-1" /> Position</Button>
                </div>

                {/* Dates + treatment */}
                <div className="grid md:grid-cols-2 gap-3">
                  <Field label="Rechnungsdatum"><Input type="date" value={form.issue_date} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} /></Field>
                  <Field label="Zahlungsziel (Tage)"><Input type="number" value={form.due_days} onChange={(e) => setForm({ ...form, due_days: e.target.value })} /></Field>
                  <Field label="Leistungszeitraum von"><Input type="date" value={form.service_period_start} onChange={(e) => setForm({ ...form, service_period_start: e.target.value })} /></Field>
                  <Field label="Leistungszeitraum bis"><Input type="date" value={form.service_period_end} onChange={(e) => setForm({ ...form, service_period_end: e.target.value })} /></Field>
                  <Field label="Steuerbehandlung">
                    <Select value={form.tax_treatment} onValueChange={(v) => setForm({ ...form, tax_treatment: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Automatisch ({TREATMENT_LABEL[treatment]})</SelectItem>
                        <SelectItem value="standard">20% USt (Inland)</SelectItem>
                        <SelectItem value="reverse_charge">Reverse Charge (EU)</SelectItem>
                        <SelectItem value="not_taxable">Nicht steuerbar (Drittland)</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                <Field label="Notiz (optional)">
                  <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
                </Field>

                {/* Totals preview */}
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm space-y-1">
                  <div className="flex justify-between"><span>Netto</span><span>{fmtEur(net)}</span></div>
                  <div className="flex justify-between"><span>USt {vatRate ? `(${vatRate}%)` : ""}</span><span>{fmtEur(vat)}</span></div>
                  <div className="flex justify-between font-bold text-base border-t border-blue-200 pt-1"><span>Gesamt</span><span>{fmtEur(gross)}</span></div>
                  {treatment !== "standard" && (
                    <p className="text-xs text-blue-700 pt-1">Hinweis: {TREATMENT_LABEL[treatment]} – es wird keine USt ausgewiesen.</p>
                  )}
                </div>
              </>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowCreate(false)} disabled={creating}>Abbrechen</Button>
            <Button variant="outline" onClick={() => submitInvoice(false)} disabled={creating || !form.organization_id}>
              {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} Als Entwurf
            </Button>
            <Button onClick={() => submitInvoice(true)} disabled={creating || !form.organization_id}>
              {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />} Erstellen & Senden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-slate-600">{label}</Label>
      {children}
    </div>
  );
}
