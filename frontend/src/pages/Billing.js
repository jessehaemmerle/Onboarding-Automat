import { useState, useEffect } from "react";
import api from "../lib/api";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog";
import { 
  CreditCard, Users, FolderKanban, HardDrive, FileText, Check,
  TrendingUp, Calendar, Loader2, AlertCircle, ArrowRight, Zap, Crown
} from "lucide-react";


const TIER_ICONS = {
  starter: "🚀",
  team: "👥",
  business: "🏢",
  enterprise: "🏛️",
  unlimited: "♾️"
};

const TIER_COLORS = {
  starter: "bg-slate-100 border-slate-300",
  team: "bg-blue-50 border-blue-300",
  business: "bg-purple-50 border-purple-300",
  enterprise: "bg-amber-50 border-amber-300",
  unlimited: "bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-300"
};

export default function Billing() {
  const [usage, setUsage] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [selectedTier, setSelectedTier] = useState(null);
  const [billingCycle, setBillingCycle] = useState("monthly");
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [usageRes, subRes, tiersRes] = await Promise.all([
        api.get(`/billing/usage`),
        api.get(`/billing/subscription`),
        api.get(`/billing/tiers`)
      ]);
      setUsage(usageRes.data);
      setSubscription(subRes.data);
      setTiers(tiersRes.data);
    } catch (err) {
      console.error("Fetch error:", err);
      toast.error("Fehler beim Laden der Billing-Daten");
    } finally {
      setLoading(false);
    }
  };

  const openUpgradeDialog = (tier) => {
    setSelectedTier(tier);
    setShowUpgradeDialog(true);
  };

  const requestUpgrade = async () => {
    if (!selectedTier) return;
    
    setUpgrading(true);
    try {
      await api.post(`/billing/upgrade`, {
        new_tier: selectedTier.tier,
        billing_cycle: billingCycle
      });
      toast.success("Upgrade-Anfrage gesendet! Wir melden uns bei Ihnen.");
      setShowUpgradeDialog(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Fehler beim Upgrade-Antrag");
    } finally {
      setUpgrading(false);
    }
  };

  const formatLimit = (value) => {
    if (value === undefined || value === null) return "—";
    if (value === -1) return "Unbegrenzt";
    return value.toLocaleString();
  };

  const getUsageColor = (percentage) => {
    if (percentage >= 90) return "bg-red-500";
    if (percentage >= 75) return "bg-yellow-500";
    return "bg-blue-500";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const currentTierIndex = tiers.findIndex(t => t.tier === usage?.tier);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CreditCard className="w-6 h-6 text-blue-600" />
          Abrechnung & Lizenz
        </h1>
        <p className="text-slate-600 mt-1">
          Verwalten Sie Ihr Abonnement und überwachen Sie die Nutzung
        </p>
      </div>

      {/* Current Plan Overview */}
      <Card className={`${TIER_COLORS[usage?.tier] || TIER_COLORS.starter} border-2`}>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="text-4xl">{TIER_ICONS[usage?.tier] || "🚀"}</div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold">{usage?.tier_name} Plan</h2>
                  <Badge variant={usage?.subscription_status === "active" ? "default" : "destructive"}>
                    {usage?.subscription_status === "active" ? "Aktiv" : usage?.subscription_status}
                  </Badge>
                </div>
                <p className="text-slate-600 text-sm mt-1">
                  {subscription?.billing_cycle === "yearly" ? "Jährliche" : "Monatliche"} Abrechnung
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">
                €{subscription?.billing_cycle === "yearly" 
                  ? Math.round(subscription?.price_yearly / 12) 
                  : subscription?.price_monthly}/Monat
              </div>
              {subscription?.billing_cycle === "yearly" && (
                <p className="text-sm text-green-600">€{subscription?.price_yearly}/Jahr (2 Monate gratis)</p>
              )}
              {usage?.renewal_date && (
                <p className="text-xs text-slate-500 flex items-center gap-1 justify-end mt-1">
                  <Calendar className="w-3 h-3" />
                  Verlängert am {new Date(usage.renewal_date).toLocaleDateString("de-DE")}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Usage Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium">Benutzer</span>
              </div>
              <span className="text-sm text-slate-500">
                {usage?.users?.current} / {formatLimit(usage?.users?.limit)}
              </span>
            </div>
            <Progress 
              value={usage?.users?.limit === -1 ? 10 : usage?.users?.percentage} 
              className={`h-2 ${getUsageColor(usage?.users?.percentage)}`}
            />
            {usage?.users?.percentage >= 80 && usage?.users?.limit !== -1 && (
              <p className="text-xs text-amber-600 mt-1">Fast am Limit!</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <FolderKanban className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium">Cases/Monat</span>
              </div>
              <span className="text-sm text-slate-500">
                {usage?.cases?.current} / {formatLimit(usage?.cases?.limit)}
              </span>
            </div>
            <Progress 
              value={usage?.cases?.limit === -1 ? 10 : usage?.cases?.percentage} 
              className={`h-2 ${getUsageColor(usage?.cases?.percentage)}`}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-purple-600" />
                <span className="text-sm font-medium">Speicher</span>
              </div>
              <span className="text-sm text-slate-500">
                {usage?.storage?.current_mb} MB / {formatLimit(usage?.storage?.limit_mb)} MB
              </span>
            </div>
            <Progress 
              value={usage?.storage?.limit_mb === -1 ? 10 : usage?.storage?.percentage} 
              className={`h-2 ${getUsageColor(usage?.storage?.percentage)}`}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-orange-600" />
                <span className="text-sm font-medium">Templates</span>
              </div>
              <span className="text-sm text-slate-500">
                {usage?.templates?.current} / {formatLimit(usage?.templates?.limit)}
              </span>
            </div>
            <Progress 
              value={usage?.templates?.limit === -1 ? 10 : usage?.templates?.percentage} 
              className={`h-2 ${getUsageColor(usage?.templates?.percentage)}`}
            />
          </CardContent>
        </Card>
      </div>

      {/* Available Plans */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Verfügbare Pakete
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {tiers.map((tier, index) => {
            const isCurrent = tier.tier === usage?.tier;
            const isUpgrade = index > currentTierIndex;
            
            return (
              <Card 
                key={tier.tier} 
                className={`relative ${isCurrent ? 'ring-2 ring-blue-500' : ''} ${
                  tier.tier === 'enterprise' ? 'border-amber-300' : ''
                }`}
              >
                {isCurrent && (
                  <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-blue-600">
                    Aktuell
                  </Badge>
                )}
                {tier.tier === 'enterprise' && !isCurrent && (
                  <Badge className="absolute -top-2 right-2 bg-amber-500">
                    <Crown className="w-3 h-3 mr-1" />
                    Beliebt
                  </Badge>
                )}
                <CardHeader className="pb-2">
                  <div className="text-2xl mb-1">{TIER_ICONS[tier.tier]}</div>
                  <CardTitle className="text-lg">{tier.name}</CardTitle>
                  <div className="mt-2">
                    <span className="text-2xl font-bold">€{tier.price_monthly}</span>
                    <span className="text-slate-500">/Monat</span>
                  </div>
                  <p className="text-xs text-slate-500">
                    oder €{tier.price_yearly}/Jahr
                  </p>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm mb-4">
                    <li className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-slate-400" />
                      {formatLimit(tier.user_limit)} Benutzer
                    </li>
                    <li className="flex items-center gap-2">
                      <FolderKanban className="w-4 h-4 text-slate-400" />
                      {formatLimit(tier.case_limit)} Cases/Monat
                    </li>
                    <li className="flex items-center gap-2">
                      <HardDrive className="w-4 h-4 text-slate-400" />
                      {tier.storage_limit_mb === -1 ? "Unbegrenzt" : `${tier.storage_limit_mb / 1000} GB`} Speicher
                    </li>
                  </ul>
                  
                  {isUpgrade ? (
                    <Button 
                      className="w-full" 
                      onClick={() => openUpgradeDialog(tier)}
                    >
                      Upgraden <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  ) : isCurrent ? (
                    <Button className="w-full" variant="outline" disabled>
                      Aktueller Plan
                    </Button>
                  ) : (
                    <Button className="w-full" variant="ghost" disabled>
                      Nicht verfügbar
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Features included */}
      {subscription?.features && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-500" />
              Enthaltene Features
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {subscription.features.map(feature => (
                <div key={feature} className="flex items-center gap-2 text-sm">
                  <Check className="w-4 h-4 text-green-500" />
                  <span className="capitalize">{feature.replace(/_/g, ' ')}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upgrade Dialog */}
      <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              Upgrade auf {selectedTier?.name}
            </DialogTitle>
            <DialogDescription>
              Wählen Sie Ihren Abrechnungszeitraum
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div 
                onClick={() => setBillingCycle("monthly")}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  billingCycle === "monthly" ? "border-blue-500 bg-blue-50" : "border-slate-200"
                }`}
              >
                <div className="font-medium">Monatlich</div>
                <div className="text-2xl font-bold mt-1">€{selectedTier?.price_monthly}</div>
                <div className="text-sm text-slate-500">pro Monat</div>
              </div>
              <div 
                onClick={() => setBillingCycle("yearly")}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all relative ${
                  billingCycle === "yearly" ? "border-blue-500 bg-blue-50" : "border-slate-200"
                }`}
              >
                <Badge className="absolute -top-2 right-2 bg-green-500">2 Monate gratis</Badge>
                <div className="font-medium">Jährlich</div>
                <div className="text-2xl font-bold mt-1">€{selectedTier?.price_yearly}</div>
                <div className="text-sm text-slate-500">pro Jahr</div>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg">
              <h4 className="font-medium mb-2">Ihre neuen Limits:</h4>
              <ul className="space-y-1 text-sm">
                <li>✓ {formatLimit(selectedTier?.user_limit)} Benutzer</li>
                <li>✓ {formatLimit(selectedTier?.case_limit)} Cases pro Monat</li>
                <li>✓ {selectedTier?.storage_limit_mb === -1 ? "Unbegrenzter" : `${selectedTier?.storage_limit_mb / 1000} GB`} Speicher</li>
              </ul>
            </div>

            <div className="flex items-start gap-2 text-sm text-slate-600 bg-amber-50 p-3 rounded-lg">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p>
                Nach dem Absenden wird unser Vertriebsteam Sie kontaktieren, 
                um die Zahlungsdetails zu klären.
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUpgradeDialog(false)}>
              Abbrechen
            </Button>
            <Button onClick={requestUpgrade} disabled={upgrading}>
              {upgrading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Senden...
                </>
              ) : (
                <>
                  Upgrade anfragen
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
