import React, { useEffect, useMemo, useState, Component } from "react";

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error("[RepairScout] Render error:", error, info); }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, fontFamily: "system-ui", background: "#0d1829", minHeight: "100vh", color: "#f1f5f9" }}>
          <h2 style={{ color: "#f87171" }}>Something went wrong</h2>
          <p style={{ color: "#94a3b8", fontSize: 13 }}>{this.state.error?.message}</p>
          <button onClick={() => this.setState({ error: null })} style={{ marginTop: 16, background: "#1e3a5f", color: "#f1f5f9", border: "none", padding: "10px 20px", borderRadius: 8, cursor: "pointer" }}>
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
import {
  ArrowRight,
  BadgeCheck,
  Bell,
  Bot,
  Building2,
  Calendar,
  Car,
  Check,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  FileCheck2,
  FileText,
  Gauge,
  Headphones,
  LayoutDashboard,
  Mail,
  MapPin,
  Menu,
  MessageSquareText,
  Package,
  PackageSearch,
  Phone,
  Receipt,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  Store,
  Trash2,
  Truck,
  UserRound,
  Users,
  Copy,
  Wrench,
  X,
} from "lucide-react";
import {
  diagnosisResults, partsResults, quoteRequests, shops as demoShops,
  diagnosisResultsEn, partsResultsEn, shopsEn, quoteRequestsEn,
} from "./demoData";
import {
  approveRepairQuote,
  buildPartsQuote,
  createDiagnosis,
  decodeVin,
  getDiagnoseResult,
  getCurrentUser,
  getQuoteRequests,
  getSentQuotes,
  getShopProfile,
  getSystemHealth,
  getTrackingInfo,
  loginAccount,
  registerAccount,
  runFreeDiagnosis,
  saveShopProfile,
  saveQuoteRequest,
  saveVehicle,
  searchShops,
  sendItemizedQuote,
  sendOtp,
  startCheckout,
  updateQuoteRequestStatus,
  updateRepairStage,
  verifyOtp,
  startPartsVerification,
  getPartsInquiryBatch,
  searchParts,
  getAdminStats,
  getAdminUsers,
  setAdminUserRole,
  getAdminQuotes,
  getAdminPlans,
  updateAdminPlan,
  setTrackingInfo,
  sendInvoice,
} from "./api";
import { T, confidenceDisplay, safetyLevelDisplay, statusDisplay, quoteStatusKeys } from "./i18n";

const LangCtx = React.createContext({ lang: "es", setLang: () => {} });
function useT() {
  const { lang } = React.useContext(LangCtx);
  return (key) => T[lang]?.[key] ?? T.es[key] ?? key;
}
function useLang() { return React.useContext(LangCtx); }

const quoteStatuses = quoteStatusKeys;

function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark"><Wrench size={19} strokeWidth={2.5} /></span>
      <span>Repair<span>Scout</span></span>
    </div>
  );
}

function TopBar({ portal, setPortal, page, setPage, user, onAuth, onLogout }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { lang, setLang } = useLang();
  const t = useT();
  const goHome = (nextPortal = portal) => {
    setPage("home");
    setPortal(nextPortal);
    setMobileOpen(false);
  };

  return (
    <header className="topbar">
      <button className="brand-button" onClick={() => goHome("customer")}><Brand /></button>
      <nav className={mobileOpen ? "main-nav open" : "main-nav"}>
        <button className={page === "home" && portal === "customer" ? "active" : ""} onClick={() => goHome("customer")}>
          {t("forDrivers")}
        </button>
        <button className={page === "home" && portal === "shop" ? "active" : ""} onClick={() => goHome("shop")}>
          {t("forShops")}
        </button>
        <button onClick={() => { setPage("support"); setMobileOpen(false); }}>{t("support")}</button>
      </nav>
      <div className="top-actions">
        <button
          onClick={() => setLang(lang === "es" ? "en" : "es")}
          title={lang === "es" ? "Switch to English" : "Cambiar a español"}
          style={{
            fontSize: 11, fontWeight: 700, letterSpacing: ".08em", padding: "5px 11px",
            borderRadius: 6, border: "1px solid #1e2d47", background: "transparent",
            color: "#94a3b8", cursor: "pointer", fontFamily: "inherit",
          }}
        >
          {lang === "es" ? "EN" : "ES"}
        </button>
        {user ? (
          <button className="account-chip" onClick={onLogout}><UserRound size={16} />{user.name}<small>{t("signOut")}</small></button>
        ) : (
          <button className="text-button" onClick={onAuth}>{t("signIn")}</button>
        )}
        <button className="primary small" onClick={() => goHome(portal === "customer" ? "shop" : "customer")}>
          {portal === "customer" ? t("shopPortal") : t("driverView")}
        </button>
      </div>
      <button className="mobile-menu" aria-label="Abrir o cerrar menú" onClick={() => setMobileOpen((value) => !value)}>
        {mobileOpen ? <X /> : <Menu />}
      </button>
    </header>
  );
}

function AuthModal({ onClose, onAuthenticated }) {
  const { lang } = useLang();
  const isEn = lang === "en";
  const [mode, setMode] = useState("register");
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "driver", shopName: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = mode === "register"
        ? await registerAccount(form)
        : await loginAccount({ email: form.email, password: form.password });
      window.localStorage.setItem("repairscout_token", result.token);
      onAuthenticated(result.user);
      onClose();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop centered" onClick={onClose}>
      <form className="auth-modal" onSubmit={submit} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="drawer-close" onClick={onClose}><X /></button>
        <span className="eyebrow dark"><ShieldCheck size={15} /> RepairScout</span>
        <h2>{mode === "register" ? (isEn ? "Create your account" : "Crea tu cuenta") : (isEn ? "Welcome back" : "Bienvenido de nuevo")}</h2>
        <p>{isEn ? "Save vehicles, diagnoses and quote requests." : "Guarda vehículos, diagnósticos y solicitudes de cotización."}</p>
        {mode === "register" && (
          <>
            <label htmlFor="auth-name">{isEn ? "Name" : "Nombre"}</label>
            <input id="auth-name" value={form.name} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))} required />
            <label>{isEn ? "Account type" : "Tipo de cuenta"}</label>
            <div className="role-picker">
              <button type="button" className={form.role === "driver" ? "active" : ""} onClick={() => setForm((c) => ({ ...c, role: "driver" }))}>{isEn ? "Driver" : "Conductor"}</button>
              <button type="button" className={form.role === "shop" ? "active" : ""} onClick={() => setForm((c) => ({ ...c, role: "shop" }))}>{isEn ? "Shop" : "Taller"}</button>
            </div>
            {form.role === "shop" && (
              <>
                <label htmlFor="shop-name">{isEn ? "Shop name" : "Nombre del taller"}</label>
                <input id="shop-name" value={form.shopName} onChange={(e) => setForm((c) => ({ ...c, shopName: e.target.value }))} required />
              </>
            )}
          </>
        )}
        <label htmlFor="auth-email">{isEn ? "Email" : "Correo electrónico"}</label>
        <input id="auth-email" type="email" value={form.email} onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))} required />
        <label htmlFor="auth-password">{isEn ? "Password" : "Contraseña"}</label>
        <input id="auth-password" type="password" minLength="8" value={form.password} onChange={(e) => setForm((c) => ({ ...c, password: e.target.value }))} required />
        {error && <p className="form-error">{error}</p>}
        <button className="primary full" disabled={loading}>
          {loading ? (isEn ? "Processing..." : "Procesando...") : mode === "register" ? (isEn ? "Create account" : "Crear cuenta") : (isEn ? "Sign in" : "Iniciar sesión")}
        </button>
        <button type="button" className="auth-switch" onClick={() => setMode((c) => c === "register" ? "login" : "register")}>
          {mode === "register"
            ? (isEn ? "Already have an account? Sign in" : "¿Ya tienes cuenta? Inicia sesión")
            : (isEn ? "No account? Sign up" : "¿No tienes cuenta? Regístrate")}
        </button>
      </form>
    </div>
  );
}

/* ── Shop panel components ── */

function RequestsFullPanel({ requests, onSelect }) {
  const t = useT();
  const { lang } = useLang();
  const sdMap = statusDisplay[lang] || statusDisplay.es;
  const [filter, setFilter] = useState("all");
  const statuses = ["all", ...quoteStatuses, "Solicitud nueva"];
  const filtered = filter === "all" ? requests : requests.filter((r) => r.status === filter);

  return (
    <section className="panel">
      <div className="panel-title">
        <div><h2>{t("requestsTitle")}</h2><p>{requests.length} {t("receivedInApp")}</p></div>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {statuses.map((s) => {
          const count = s === "all" ? requests.length : requests.filter((r) => r.status === s).length;
          const displayLabel = s === "all" ? t("requestsAll") : (sdMap[s] ?? s);
          return (
            <button key={s} onClick={() => setFilter(s)} style={{
              fontSize: 11, padding: "5px 12px", borderRadius: 20, cursor: "pointer",
              border: filter === s ? "1px solid rgba(249,115,22,.4)" : "1px solid #151c2a",
              background: filter === s ? "rgba(249,115,22,.1)" : "transparent",
              color: filter === s ? "#f97316" : "#64748b", fontFamily: "inherit",
            }}>
              {displayLabel} {count > 0 ? `(${count})` : ""}
            </button>
          );
        })}
      </div>
      <div className="request-list">
        {filtered.length === 0 ? (
          <p style={{ color: "#334155", fontSize: 12, padding: "32px 0", textAlign: "center" }}>{t("noRequests")}</p>
        ) : filtered.map((r) => (
          <button className="request-row" key={r.id || `${r.customer}-${r.vehicle}`} onClick={() => onSelect(r)}>
            <span className="request-avatar">{r.initials}</span>
            <span className="request-main">
              <span><strong>{r.customer}</strong><i className={r.status === "Cotizada" ? "quoted" : ""}>{sdMap[r.status] ?? r.status}</i></span>
              <b>{r.vehicle}</b>
              <small>{r.issue}</small>
            </span>
            <span className="request-meta"><strong>{r.value}</strong><small>{r.distance} · {r.time}</small><ChevronRight size={17} /></span>
          </button>
        ))}
      </div>
    </section>
  );
}

function AppointmentsPanel({ onBook }) {
  const t = useT();
  const { lang } = useLang();
  const isEn = lang === "en";
  const apts = [
    { time: "8:30",  customer: "Taylor Kim",    vehicle: "Subaru Outback 2020",    service: isEn ? "Oil change & inspection" : "Cambio de aceite e inspección",  status: "active",     tech: "Carlos M." },
    { time: "10:00", customer: "Marcus Hill",    vehicle: "Chevrolet Malibu 2018",  service: isEn ? "Brake diagnosis" : "Diagnóstico de frenos",                  status: "scheduled",  tech: "Ana V." },
    { time: "11:30", customer: "Ana Cruz",       vehicle: "Honda Civic 2016",       service: isEn ? "A/C not cooling" : "El A/C no enfría",                       status: "scheduled",  tech: "Luis R." },
    { time: "1:00",  customer: null,             vehicle: null,                     service: null,                                                                status: "open",       tech: null },
    { time: "2:30",  customer: "Roberto Paz",    vehicle: "Toyota Camry 2021",      service: isEn ? "Pre-trip inspection" : "Revisión pre-viaje",                 status: "scheduled",  tech: "Carlos M." },
    { time: "4:00",  customer: null,             vehicle: null,                     service: null,                                                                status: "open",       tech: null },
  ];
  const bookedCount = apts.filter((a) => a.status !== "open").length;
  const openCount = apts.filter((a) => a.status === "open").length;

  return (
    <section className="panel">
      <div className="panel-title">
        <div>
          <h2>{t("appointmentsTitle")}</h2>
          <p>{t("scheduleDate")} · {bookedCount} {isEn ? "appts" : "citas"} · {openCount} {isEn ? "open slots" : "espacios disponibles"}</p>
        </div>
        <button className="primary small" onClick={onBook}>+ {t("newApptBtn")}</button>
      </div>
      <div className="timeline">
        {apts.map((a) => (
          <div key={a.time}>
            <time>{a.time}</time>
            <span className={`timeline-dot${a.status === "active" ? " active" : a.status === "open" ? " empty" : ""}`} />
            <article>
              {a.status === "open" ? (
                <div className="open-slot"><strong>{t("apptSlot")}</strong><button onClick={onBook}>{t("reserveBtn")}</button></div>
              ) : (
                <>
                  <strong>{a.service}</strong>
                  <p>{a.customer} · {a.vehicle}</p>
                  <i className={a.status === "active" ? "" : "scheduled"}>{a.status === "active" ? t("apptInProgress") : t("apptConfirmed")} · {a.tech}</i>
                </>
              )}
            </article>
          </div>
        ))}
      </div>
    </section>
  );
}

function InvoiceModal({ order, lang, onClose, onSent }) {
  const isEn = lang === "en";
  const _hasData = (q) => q && Object.keys(q).length > 0;
  const displayQ = _hasData(order?.quoteSingle) ? order.quoteSingle : _hasData(order?.quoteCombo) ? order.quoteCombo : null;
  const veh = order?.vehicle || {};
  const vehicleStr = [veh.year, veh.make, veh.model].filter(Boolean).join(" ") || "—";

  const [upchargePct, setUpchargePct] = useState(order?.partsUpchargePct ?? 20);
  const [paymentType, setPaymentType] = useState("full");
  const [depositPct, setDepositPct] = useState(50);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const partsOriginal = displayQ?.partsCost || 0;
  const partsWithUpcharge = partsOriginal * (1 + upchargePct / 100);
  const upchargeAmount = partsWithUpcharge - partsOriginal;
  const laborMid = ((displayQ?.laborLow || 0) + (displayQ?.laborHigh || 0)) / 2;
  const invoiceTotal = partsWithUpcharge + laborMid;
  const amountDue = paymentType === "deposit" ? invoiceTotal * (depositPct / 100) : invoiceTotal;

  const doSend = async () => {
    setSending(true); setError("");
    try {
      await sendInvoice(order.id, { paymentType, depositPct, invoiceTotal });
      setSent(true);
      onSent?.();
    } catch (e) { setError(e.message); }
    finally { setSending(false); }
  };

  const OVERLAY = { position: "fixed", inset: 0, background: "#000b", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 };
  const CARD = { background: "#0d1829", border: "1px solid #1e2d47", borderRadius: 14, width: "100%", maxWidth: 540, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px #0009" };
  const ROW = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: "1px solid #0e1a2e", fontSize: 12 };

  return (
    <div style={OVERLAY} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={CARD}>
        <div style={{ padding: "18px 22px", borderBottom: "1px solid #1e2d47", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Receipt size={18} color="#f97316" />
            <span style={{ fontWeight: 700, fontSize: 15, color: "#f1f5f9" }}>{isEn ? "Invoice" : "Factura"}</span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: "18px 22px" }}>
          {/* Customer + Vehicle */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>{isEn ? "Customer" : "Cliente"}</div>
            <div style={{ fontWeight: 700, color: "#f1f5f9", fontSize: 14 }}>{order.customerName}</div>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>{vehicleStr}</div>
            {order.customerEmail && <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{order.customerEmail}</div>}
          </div>

          {/* Parts upcharge slider */}
          <div style={{ background: "#060f1a", border: "1px solid #1e2d47", borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0" }}>{isEn ? "Parts Sourcing Fee" : "Cargo por abastecimiento"}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#f97316" }}>{upchargePct}%</span>
            </div>
            <input type="range" min="10" max="40" step="5" value={upchargePct} onChange={(e) => setUpchargePct(Number(e.target.value))}
              style={{ width: "100%", accentColor: "#f97316", cursor: "pointer" }} />
            <p style={{ fontSize: 10, color: "#475569", margin: "8px 0 0" }}>
              {isEn
                ? `Parts are sourced, ordered, and guaranteed by the shop. A ${upchargePct}% handling & warranty fee applies.`
                : `Las piezas son abastecidas, pedidas y garantizadas por el taller. Se aplica un cargo del ${upchargePct}% por manejo y garantía.`}
            </p>
          </div>

          {/* Line items */}
          <div style={{ background: "#060f1a", border: "1px solid #1e2d47", borderRadius: 8, overflow: "hidden", marginBottom: 16 }}>
            <div style={{ padding: "8px 14px", background: "#0a1828", fontSize: 10, color: "#475569", fontWeight: 600, letterSpacing: ".06em", display: "flex", justifyContent: "space-between" }}>
              <span>{isEn ? "ITEM" : "CONCEPTO"}</span><span>{isEn ? "AMOUNT" : "MONTO"}</span>
            </div>
            {(displayQ?.lineItems || []).map((item) => (
              <div key={item.partKey} style={ROW}>
                <span style={{ color: "#94a3b8", paddingLeft: 14 }}>{isEn ? item.nameEn : item.nameEs} × {item.qty}</span>
                <span style={{ color: "#f1f5f9", paddingRight: 14 }}>{fmt(item.totalPrice)}</span>
              </div>
            ))}
            <div style={{ ...ROW, paddingLeft: 14, paddingRight: 14 }}>
              <span style={{ color: "#64748b" }}>{isEn ? "Parts subtotal" : "Subtotal piezas"}</span>
              <span style={{ color: "#94a3b8" }}>{fmt(partsOriginal)}</span>
            </div>
            <div style={{ ...ROW, paddingLeft: 14, paddingRight: 14 }}>
              <span style={{ color: "#f97316" }}>{isEn ? `Sourcing fee (${upchargePct}%)` : `Cargo de abastecimiento (${upchargePct}%)`}</span>
              <span style={{ color: "#f97316" }}>+{fmt(upchargeAmount)}</span>
            </div>
            <div style={{ ...ROW, paddingLeft: 14, paddingRight: 14 }}>
              <span style={{ color: "#64748b" }}>{isEn ? "Parts total (with fee)" : "Total piezas (con cargo)"}</span>
              <span style={{ color: "#f1f5f9", fontWeight: 600 }}>{fmt(partsWithUpcharge)}</span>
            </div>
            <div style={{ ...ROW, paddingLeft: 14, paddingRight: 14 }}>
              <span style={{ color: "#64748b" }}>{isEn ? "Labor (avg. estimate)" : "Mano de obra (promedio)"}</span>
              <span style={{ color: "#f1f5f9" }}>{fmt(laborMid)}</span>
            </div>
            <div style={{ padding: "10px 14px", display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 700 }}>
              <span style={{ color: "#f1f5f9" }}>{isEn ? "Invoice Total" : "Total de factura"}</span>
              <span style={{ color: "#4ade80" }}>{fmt(invoiceTotal)}</span>
            </div>
          </div>

          {/* Payment type */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, letterSpacing: ".06em", marginBottom: 8 }}>
              {isEn ? "PAYMENT REQUEST" : "TIPO DE PAGO"}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {["full", "deposit"].map((pt) => (
                <button key={pt} onClick={() => setPaymentType(pt)} style={{
                  flex: 1, padding: "9px 0", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                  border: paymentType === pt ? "1.5px solid #f97316" : "1px solid #1e2d47",
                  background: paymentType === pt ? "rgba(249,115,22,.12)" : "transparent",
                  color: paymentType === pt ? "#f97316" : "#64748b",
                }}>
                  {pt === "full" ? (isEn ? "Full Payment" : "Pago completo") : (isEn ? "Deposit" : "Depósito")}
                </button>
              ))}
            </div>
            {paymentType === "deposit" && (
              <div style={{ marginTop: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
                  <span style={{ color: "#64748b" }}>{isEn ? "Deposit %" : "% de depósito"}</span>
                  <span style={{ color: "#f97316", fontWeight: 700 }}>{depositPct}% = {fmt(amountDue)}</span>
                </div>
                <input type="range" min="25" max="75" step="25" value={depositPct} onChange={(e) => setDepositPct(Number(e.target.value))}
                  style={{ width: "100%", accentColor: "#f97316" }} />
              </div>
            )}
          </div>

          {/* Amount due summary */}
          <div style={{ background: "rgba(74,222,128,.06)", border: "1px solid rgba(74,222,128,.3)", borderRadius: 8, padding: "12px 16px", marginBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "#94a3b8" }}>{isEn ? "Amount due now" : "Monto a pagar ahora"}</span>
            <span style={{ fontSize: 20, fontWeight: 700, color: "#4ade80" }}>{fmt(amountDue)}</span>
          </div>

          {error && <p style={{ color: "#f87171", fontSize: 12, marginBottom: 12 }}>{error}</p>}

          {sent ? (
            <div style={{ textAlign: "center", padding: "12px 0", color: "#4ade80", fontWeight: 700 }}>
              <Check size={18} style={{ verticalAlign: "middle", marginRight: 6 }} />
              {isEn ? "Invoice sent to customer!" : "¡Factura enviada al cliente!"}
            </div>
          ) : (
            <button className="primary" style={{ width: "100%" }} onClick={doSend} disabled={sending}>
              {sending ? (isEn ? "Sending…" : "Enviando…") : (isEn ? "Send Invoice to Customer" : "Enviar factura al cliente")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function getCarrierTrackUrl(carrier, trackingNum) {
  if (!trackingNum) return null;
  const n = encodeURIComponent(trackingNum);
  switch ((carrier || "").toUpperCase()) {
    case "UPS":    return `https://www.ups.com/track?tracknum=${n}`;
    case "FEDEX":  return `https://www.fedex.com/apps/fedextrack/?trknbr=${n}`;
    case "USPS":   return `https://tools.usps.com/go/TrackConfirmAction?qtc_tLabels1=${n}`;
    case "AMAZON": return `https://www.amazon.com/gp/your-account/ship-track?orderID=${n}`;
    default:       return `https://www.google.com/search?q=${encodeURIComponent((carrier || "package") + " tracking " + trackingNum)}`;
  }
}

function WorkOrdersPanel({ user }) {
  const t = useT();
  const { lang } = useLang();
  const isEn = lang === "en";
  const stageLabelMap = STAGE_LABELS[isEn ? "en" : "es"];
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [updating, setUpdating] = useState("");
  const [trackingVal, setTrackingVal] = useState("");
  const [carrierVal, setCarrierVal] = useState("UPS");
  const [savingTracking, setSavingTracking] = useState(false);
  const [invoiceOrder, setInvoiceOrder] = useState(null);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    getSentQuotes()
      .then(({ quotes: q }) => setOrders(q || []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, [user]);

  const refresh = () => {
    if (!user) return;
    getSentQuotes().then(({ quotes: q }) => setOrders(q || [])).catch(() => {});
  };

  const advanceStage = async (quoteId, toStage) => {
    setUpdating(`${quoteId}:${toStage}`);
    try {
      const { quote: updated } = await updateRepairStage(quoteId, toStage);
      setOrders((os) => os.map((o) => o.id === quoteId ? updated : o));
      setExpanded((e) => e?.id === quoteId ? updated : e);
    } catch (e) { console.error(e); }
    finally { setUpdating(""); }
  };

  const saveTracking = async (order) => {
    if (!trackingVal.trim()) return;
    setSavingTracking(true);
    try {
      const { quote: updated } = await setTrackingInfo(order.id, trackingVal.trim(), carrierVal);
      setOrders((os) => os.map((o) => o.id === order.id ? updated : o));
      setExpanded(updated);
      if (["Approved", "Parts Ordered"].includes(order.repairStage)) {
        await advanceStage(order.id, "Parts In Transit");
      }
      setTrackingVal(""); setCarrierVal("UPS");
    } catch (e) { console.error(e); }
    finally { setSavingTracking(false); }
  };

  const stageColor = (stage) => {
    const idx = REPAIR_STAGES.indexOf(stage);
    if (idx >= REPAIR_STAGES.indexOf("Paid")) return "#4ade80";
    if (idx >= REPAIR_STAGES.indexOf("Completed")) return "#4ade80";
    if (idx >= REPAIR_STAGES.indexOf("In Progress")) return "#38bdf8";
    if (idx >= REPAIR_STAGES.indexOf("Parts In Transit")) return "#a78bfa";
    if (stage === "Approved") return "#fbbf24";
    return "#f97316";
  };

  const DEMO = [
    { id: "demo-1", customerName: "Taylor Kim",   vehicle: { year: "2020", make: "Subaru", model: "Outback" },   repairStage: "In Progress",   quoteCombo: { totalLow: 310, totalHigh: 380, partsCost: 140, laborLow: 170, laborHigh: 240, lineItems: [] } },
    { id: "demo-2", customerName: "Diana Torres", vehicle: { year: "2019", make: "Ford",   model: "F-150" },     repairStage: "Parts Arrived", quoteCombo: { totalLow: 280, totalHigh: 340, partsCost: 120, laborLow: 160, laborHigh: 220, lineItems: [] }, trackingNumber: "1Z999AA101234", trackingCarrier: "UPS" },
    { id: "demo-3", customerName: "Sam Okoro",    vehicle: { year: "2022", make: "Tesla",  model: "Model 3" },   repairStage: "Approved",      quoteCombo: { totalLow: 200, totalHigh: 260, partsCost: 80,  laborLow: 120, laborHigh: 180, lineItems: [] } },
  ];
  const displayed = orders.length > 0 ? orders.filter((o) => o.repairStage !== "Quote Sent") : (!user ? DEMO : []);

  const INPUT = {
    background: "#060f1a", border: "1px solid #1e2d47", color: "#e2e8f0",
    padding: "8px 12px", borderRadius: 6, fontSize: 12, fontFamily: "inherit", outline: "none",
  };

  return (
    <section className="panel">
      <div className="panel-title">
        <div>
          <h2>{t("workOrdersTitle")}</h2>
          <p>{displayed.length} {isEn ? "active orders" : "órdenes activas"}</p>
        </div>
      </div>

      {loading && <p style={{ color: "#475569", fontSize: 12, padding: "32px 0", textAlign: "center" }}>{isEn ? "Loading…" : "Cargando…"}</p>}

      {!loading && displayed.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 0", color: "#334155" }}>
          <Wrench size={32} style={{ opacity: .3, marginBottom: 12 }} />
          <div style={{ fontSize: 13 }}>{isEn ? "No active work orders" : "Sin órdenes de trabajo activas"}</div>
          <div style={{ fontSize: 11, marginTop: 4, color: "#1e2d47" }}>
            {isEn ? "Work orders appear here when a customer approves a quote." : "Las órdenes aparecen cuando un cliente aprueba una cotización."}
          </div>
        </div>
      )}

      {displayed.map((o) => {
        const isOpen = expanded?.id === o.id;
        const veh = o.vehicle || {};
        const vehicleStr = [veh.year, veh.make, veh.model].filter(Boolean).join(" ") || "—";
        const hasData = (q) => q && Object.keys(q).length > 0;
        const displayQ = hasData(o.quoteSingle) ? o.quoteSingle : hasData(o.quoteCombo) ? o.quoteCombo : null;
        const stageIdx = REPAIR_STAGES.indexOf(o.repairStage);
        const nextStage = stageIdx >= 0 && stageIdx < REPAIR_STAGES.length - 1 ? REPAIR_STAGES[stageIdx + 1] : null;
        const color = stageColor(o.repairStage);
        const canAddTracking = ["Approved", "Parts Ordered"].includes(o.repairStage) && !o.trackingNumber;
        const canGenInvoice = REPAIR_STAGES.indexOf(o.repairStage) >= REPAIR_STAGES.indexOf("Parts Arrived");

        return (
          <article key={o.id} style={{ border: "1px solid #1e2d47", borderRadius: 10, marginBottom: 12, background: "#0c1524", overflow: "hidden" }}>
            <button onClick={() => setExpanded(isOpen ? null : o)} style={{
              width: "100%", background: "transparent", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", textAlign: "left",
            }}>
              <span className="request-avatar">
                {(o.customerName || "?").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: "#f1f5f9" }}>{o.customerName}</div>
                <div style={{ fontSize: 11, color: "#64748b" }}>{vehicleStr}</div>
                {o.trackingNumber && (
                  <div style={{ fontSize: 10, color: "#a78bfa", marginTop: 2 }}>
                    <Package size={10} style={{ verticalAlign: "middle", marginRight: 3 }} />
                    {o.trackingCarrier} {o.trackingNumber}
                  </div>
                )}
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 20, border: `1px solid ${color}44`, background: `${color}11`, color }}>
                  {stageLabelMap[o.repairStage] || o.repairStage}
                </span>
                {displayQ && (
                  <div style={{ fontSize: 12, color: "#f97316", fontWeight: 700, marginTop: 4 }}>
                    {fmt(displayQ.totalLow)}–{fmt(displayQ.totalHigh)}
                  </div>
                )}
              </div>
              <ChevronDown size={15} color="#334155" style={{ transform: isOpen ? "rotate(180deg)" : "", transition: ".2s", flexShrink: 0 }} />
            </button>

            {isOpen && (
              <div style={{ padding: "0 18px 18px", borderTop: "1px solid #0e1a2e" }}>
                {/* Stage timeline */}
                <div style={{ margin: "16px 0" }}>
                  <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600, letterSpacing: ".07em", marginBottom: 12 }}>
                    {isEn ? "REPAIR TIMELINE" : "PROGRESO DE REPARACIÓN"}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                    {REPAIR_STAGES.map((stage, idx) => {
                      const done = idx < stageIdx;
                      const current = idx === stageIdx;
                      return (
                        <div key={stage} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                            <div style={{
                              width: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                              background: done ? "#4ade80" : current ? stageColor(stage) : "#0e1a2e",
                              border: done ? "none" : current ? `2px solid ${stageColor(stage)}` : "1.5px solid #1e2d47",
                            }}>
                              {done && <Check size={11} color="#0a1020" />}
                              {current && <span style={{ fontSize: 7, color: stageColor(stage) }}>●</span>}
                            </div>
                            {idx < REPAIR_STAGES.length - 1 && (
                              <div style={{ width: 1, height: 20, background: done ? "#4ade8066" : "#1e2d4744" }} />
                            )}
                          </div>
                          <div style={{ paddingTop: 2, paddingBottom: 4 }}>
                            <span style={{
                              fontSize: 12, fontWeight: current ? 700 : done ? 500 : 400,
                              color: done ? "#4ade80" : current ? stageColor(stage) : "#334155",
                            }}>
                              {stageLabelMap[stage] || stage}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Advance stage */}
                {nextStage && !["Invoice Sent", "Paid"].includes(o.repairStage) && (
                  <button
                    className="primary small"
                    style={{ marginBottom: 14, fontSize: 11 }}
                    onClick={() => advanceStage(o.id, nextStage)}
                    disabled={!!updating}
                  >
                    {updating === `${o.id}:${nextStage}` ? "…" : (isEn ? `Mark as: ${stageLabelMap[nextStage]}` : `Marcar como: ${stageLabelMap[nextStage]}`)}
                  </button>
                )}

                {/* Tracking number input */}
                {canAddTracking && (
                  <div style={{ background: "#060f1a", border: "1px solid #1e2d47", borderRadius: 8, padding: "12px 14px", marginBottom: 14 }}>
                    <div style={{ fontSize: 11, color: "#a78bfa", fontWeight: 600, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                      <Truck size={13} />{isEn ? "Add Tracking Number (online order)" : "Agregar número de rastreo (pedido en línea)"}
                    </div>
                    <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                      <select value={carrierVal} onChange={(e) => setCarrierVal(e.target.value)}
                        style={{ ...INPUT, width: 90, flexShrink: 0 }}>
                        {["UPS", "FedEx", "USPS", "Amazon"].map((c) => <option key={c}>{c}</option>)}
                      </select>
                      <input value={trackingVal} onChange={(e) => setTrackingVal(e.target.value)}
                        placeholder={isEn ? "Tracking number…" : "Número de rastreo…"}
                        style={{ ...INPUT, flex: 1 }} />
                    </div>
                    <button className="outline" style={{ fontSize: 11, width: "100%" }}
                      onClick={() => saveTracking(o)} disabled={savingTracking || !trackingVal.trim()}>
                      {savingTracking ? "…" : (isEn ? "Save & Mark In Transit" : "Guardar y marcar en tránsito")}
                    </button>
                  </div>
                )}

                {/* Existing tracking display */}
                {o.trackingNumber && (
                  <div style={{ background: "#060f1a", border: "1px solid #a78bfa44", borderRadius: 8, padding: "10px 14px", marginBottom: 14 }}>
                    <div style={{ fontSize: 11, color: "#a78bfa", fontWeight: 600, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                      <Package size={13} />{o.trackingCarrier} Tracking
                    </div>
                    <div style={{ fontSize: 12, color: "#e2e8f0", fontFamily: "monospace", marginBottom: 8 }}>{o.trackingNumber}</div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="outline" style={{ fontSize: 11, flex: 1 }}
                        onClick={() => window.open(getCarrierTrackUrl(o.trackingCarrier, o.trackingNumber), "_blank")}>
                        {isEn ? "Track Package" : "Rastrear paquete"}
                      </button>
                      {o.repairStage === "Parts In Transit" && (
                        <button className="primary small" style={{ fontSize: 11, flex: 1 }}
                          onClick={() => advanceStage(o.id, "Parts Arrived")}>
                          {updating ? "…" : (isEn ? "Mark Arrived" : "Llegó")}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Invoice button */}
                {canGenInvoice && o.repairStage !== "Paid" && (
                  <button
                    onClick={() => setInvoiceOrder(o)}
                    style={{
                      width: "100%", padding: "10px 0", borderRadius: 8, border: "1px solid #4ade8044",
                      background: "rgba(74,222,128,.06)", color: "#4ade80", fontWeight: 700, fontSize: 12,
                      cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                    }}
                  >
                    <FileText size={14} />{o.invoiceSentAt ? (isEn ? "Resend Invoice" : "Reenviar factura") : (isEn ? "Generate & Send Invoice" : "Generar y enviar factura")}
                  </button>
                )}

                {o.repairStage === "Paid" && (
                  <div style={{ textAlign: "center", padding: "10px 0", color: "#4ade80", fontWeight: 700, fontSize: 13 }}>
                    <Check size={16} style={{ verticalAlign: "middle", marginRight: 6 }} />
                    {isEn ? "Payment received" : "Pago recibido"}
                    {o.paymentAmount && <span style={{ color: "#94a3b8", fontWeight: 400, marginLeft: 6 }}>{fmt(o.paymentAmount)}</span>}
                  </div>
                )}

                {/* Track link */}
                <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
                  <button className="outline" style={{ fontSize: 11, flex: 1 }}
                    onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/track/${o.token}`)}>
                    {isEn ? "Copy Track Link" : "Copiar enlace"}
                  </button>
                  <button className="outline" style={{ fontSize: 11, flex: 1 }}
                    onClick={() => window.open(`/track/${o.token}`, "_blank")}>
                    {isEn ? "View as Customer" : "Ver como cliente"}
                  </button>
                </div>
              </div>
            )}
          </article>
        );
      })}

      {invoiceOrder && (
        <InvoiceModal
          order={invoiceOrder}
          lang={lang}
          onClose={() => setInvoiceOrder(null)}
          onSent={() => { setInvoiceOrder(null); refresh(); }}
        />
      )}
    </section>
  );
}

function CustomersPanel({ requests }) {
  const t = useT();
  const { lang } = useLang();
  const isEn = lang === "en";
  const [search, setSearch] = useState("");
  const seen = new Set();
  const fromRequests = requests.filter((r) => r.customer && !seen.has(r.customer) && seen.add(r.customer));
  const extras = [
    { customer: "Taylor Kim",   vehicle: "Subaru Outback 2020",  initials: "TK", lastVisit: "Jun 15", total: "$234", visits: 3 },
    { customer: "Diana Torres", vehicle: "Ford F-150 2019",       initials: "DT", lastVisit: "Jun 10", total: "$280", visits: 1 },
    { customer: "Roberto Paz",  vehicle: "Toyota Camry 2021",     initials: "RP", lastVisit: "Jun 18", total: "$89",  visits: 2 },
  ].filter((c) => !seen.has(c.customer));
  const allCustomers = [...fromRequests, ...extras];
  const filtered = allCustomers.filter((c) => !search || c.customer.toLowerCase().includes(search.toLowerCase()));

  return (
    <section className="panel">
      <div className="panel-title">
        <div><h2>{t("customersTitle")}</h2><p>{allCustomers.length} {isEn ? "registered" : "registrados"}</p></div>
      </div>
      <input
        placeholder={t("searchCustomerPlaceholder")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          width: "100%", marginBottom: 16, background: "#0a1020", border: "1px solid #1e2d47",
          color: "#e2e8f0", padding: "10px 14px", borderRadius: 6, fontSize: 12, fontFamily: "inherit", outline: "none",
        }}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.map((c) => (
          <article key={c.customer} className="card" style={{
            padding: "14px 18px", display: "flex", alignItems: "center", gap: 16,
            cursor: "pointer", border: "1px solid #151c2a",
          }}>
            <span className="request-avatar">
              {c.initials || c.customer.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: "#f1f5f9" }}>{c.customer}</div>
              <div style={{ fontSize: 11, color: "#64748b" }}>{c.vehicle || c.issue}</div>
            </div>
            <div style={{ textAlign: "right", fontSize: 11 }}>
              <div style={{ color: "#f97316", fontWeight: 600 }}>{c.total || c.value || "—"}</div>
              <div style={{ color: "#475569" }}>{c.lastVisit || c.time || "—"}</div>
            </div>
            <ChevronRight size={16} color="#334155" />
          </article>
        ))}
        {filtered.length === 0 && (
          <p style={{ color: "#334155", fontSize: 12, padding: "32px 0", textAlign: "center" }}>No se encontraron clientes.</p>
        )}
      </div>
    </section>
  );
}

const INPUT_STYLE = { background: "#0a1020", border: "1px solid #1e2d47", color: "#e2e8f0", padding: "10px 14px", borderRadius: 6, fontSize: 12, fontFamily: "inherit", outline: "none" };

function PartsSearchPanel() {
  const { lang } = useLang();
  const isEn = lang === "en";
  const allParts = isEn ? partsResultsEn : partsResults;

  const [query, setQuery] = useState("");
  const [zip, setZip] = useState("");
  const [state, setState] = useState("");
  const [gasPrice, setGasPrice] = useState("4.00");
  const [mpg, setMpg] = useState("25");
  const [results, setResults] = useState(allParts);
  const [onlineResults, setOnlineResults] = useState([]);
  const [selfSource, setSelfSource] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [callScript, setCallScript] = useState(null);
  const [verifyBatchId, setVerifyBatchId] = useState(null);
  const [verifyLoading, setVerifyLoading] = useState(false);

  useEffect(() => { setVerifyBatchId(null); setSearchError(null); }, [lang]);

  const search = async () => {
    if (!query.trim()) { setResults(allParts); setOnlineResults([]); setHasSearched(false); setSelfSource(null); return; }
    setSearching(true);
    setSearchError(null);
    try {
      const { results: found, online, selfSource: ss } = await searchParts(
        query.trim(), lang,
        zip.trim() || undefined, state.trim() || undefined,
        parseFloat(gasPrice) || 4.00, parseFloat(mpg) || 25
      );
      setResults(found && found.length ? found : allParts);
      setOnlineResults(online || []);
      setSelfSource(ss || null);
      setHasSearched(true);
    } catch (e) {
      setSearchError(isEn ? "Search failed. Check your connection." : "Error en la búsqueda. Verifica tu conexión.");
    } finally {
      setSearching(false);
    }
  };

  return (
    <section className="panel">
      <div className="panel-title">
        <div>
          <h2>{isEn ? "Parts Search" : "Búsqueda de piezas"}</h2>
          <p>{isEn ? "Local stores + online retailers" : "Tiendas locales + tiendas en línea"}</p>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <input
          placeholder={isEn ? "e.g. exhaust pipe 1991 GMC Sonoma..." : "Ej: tubo de escape 1991 GMC Sonoma..."}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          style={{ ...INPUT_STYLE, flex: 2, minWidth: 200 }}
        />
        <input placeholder={isEn ? "ZIP" : "C.P."} value={zip} onChange={(e) => setZip(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} style={{ ...INPUT_STYLE, width: 80 }} />
        <input placeholder={isEn ? "State" : "Estado"} value={state} onChange={(e) => setState(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} style={{ ...INPUT_STYLE, width: 80 }} />
        <button className="primary" onClick={search} disabled={searching} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {searching ? (isEn ? "Searching..." : "Buscando...") : <><Search size={15} />{isEn ? "Search" : "Buscar"}</>}
        </button>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, color: "#64748b" }}>⛽ {isEn ? "Gas price/gal:" : "Gasolina/gal:"}</span>
        <input value={gasPrice} onChange={(e) => setGasPrice(e.target.value)} style={{ ...INPUT_STYLE, width: 70, padding: "6px 10px" }} />
        <span style={{ fontSize: 10, color: "#64748b" }}>🚗 MPG:</span>
        <input value={mpg} onChange={(e) => setMpg(e.target.value)} style={{ ...INPUT_STYLE, width: 60, padding: "6px 10px" }} />
        <span style={{ fontSize: 10, color: "#475569" }}>{isEn ? "Used to calculate drive cost" : "Para calcular costo de viaje"}</span>
      </div>
      {searchError && <p style={{ color: "#f87171", fontSize: 12, marginBottom: 12 }}>{searchError}</p>}

      {/* ── Local Stores ── */}
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "#64748b", marginBottom: 8 }}>
        <Store size={11} style={{ verticalAlign: "middle", marginRight: 4 }} />
        {isEn ? "Local Stores" : "Tiendas locales"}
      </div>
      <div className="parts-table">
        <div className="table-head">
          <span>{isEn ? "Seller & Part" : "Vendedor y pieza"}</span>
          <span>{isEn ? "Availability" : "Disponibilidad"}</span>
          <span>{isEn ? "Warranty" : "Garantía"}</span>
          <span>{isEn ? "In Stock" : "En stock"}</span>
          <span>{isEn ? "Price / Action" : "Precio / Acción"}</span>
        </div>
        {results.map((p, i) => (
          <div className="part-row" key={`${p.seller}-${i}`}>
            <div className="seller-cell">
              <span className="seller-icon"><Store size={20} /></span>
              <span>
                <strong>{p.seller}</strong>
                <small>{p.part}</small>
                {p.partNumber && <small style={{ color: "#93c5fd", fontSize: 9 }}>#{p.partNumber}</small>}
                <i>{p.badge}</i>
              </span>
            </div>
            <div><strong>{p.availability || (isEn ? "Same day" : "Mismo día")}</strong><small>{p.distance}</small></div>
            <div><strong>{p.warranty || "—"}</strong><small>{isEn ? "See terms" : "Ver términos"}</small></div>
            <div>
              {p.stock === null
                ? <strong style={{ color: "#64748b" }}>{isEn ? "Call to check" : "Llama para verificar"}</strong>
                : p.stock === 0
                  ? <strong style={{ color: "#ef4444" }}>{isEn ? "Out of stock" : "Sin existencias"}</strong>
                  : p.stock <= 2
                    ? <strong style={{ color: "#f97316" }}>{p.stock} {isEn ? "left" : "disponible(s)"}</strong>
                    : <strong style={{ color: "#22c55e" }}>{p.stock} {isEn ? "in stock" : "en stock"}</strong>}
              {p.stock > 0 && <small style={{ fontSize: 9, color: "#94a3b8" }}>{isEn ? "est. qty" : "cant. est."}</small>}
            </div>
            <div className="part-price">
              {p.price}
              <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                {p.phone && (
                  <button
                    style={{ color: "#3b82f6", fontWeight: 700 }}
                    onClick={() => setCallScript({ part: p.part, seller: p.seller, phone: p.phone, vehicle: query || "" })}
                  >
                    {isEn ? "Call" : "Llamar"}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Verify via AI calls ── */}
      {results.some((p) => p.phone) && (
        <div style={{ marginTop: 12, marginBottom: 24 }}>
          <button
            className="primary"
            disabled={verifyLoading}
            onClick={async () => {
              setVerifyLoading(true);
              try {
                const stores = results.filter((p) => p.phone).map((p) => ({ name: p.seller, phone: p.phone }));
                const partName = results[0]?.part || (isEn ? "Auto part" : "Pieza automotriz");
                const { batchId } = await startPartsVerification({ lang, parts: [{ partName, vehicle: query || undefined, stores }] });
                setVerifyBatchId(batchId);
              } catch (e) { console.error(e); }
              finally { setVerifyLoading(false); }
            }}
            style={{ display: "flex", alignItems: "center", gap: 8, background: "#1d4ed8" }}
          >
            <Phone size={15} />
            {verifyLoading
              ? (isEn ? "Starting calls…" : "Iniciando llamadas…")
              : (isEn ? "Verify availability via AI calls" : "Verificar con llamadas IA")}
          </button>
          <p style={{ fontSize: 10, color: "#94a3b8", marginTop: 6 }}>
            {isEn ? "Beto will call each store and confirm stock, price, and same-day pickup." : "Beto llamará a cada tienda y confirmará existencias, precio y recogida el mismo día."}
          </p>
        </div>
      )}

      {/* ── Buy It Yourself Analysis ── */}
      {hasSearched && selfSource && (
        <div style={{ background: selfSource.worthIt ? "#052e16" : "#1c0a03", border: `1px solid ${selfSource.worthIt ? "#16a34a" : "#f97316"}`, borderRadius: 10, padding: "16px 18px", marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: selfSource.worthIt ? "#4ade80" : "#fb923c", marginBottom: 10 }}>
            🚗 {isEn ? "Buy It Yourself Analysis" : "Análisis: ¿Vale la pena comprarlo?"}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginBottom: 12 }}>
            {[
              [isEn ? "Cheapest Option" : "Opción más barata", selfSource.cheapestStore, "#e2e8f0"],
              [isEn ? "Part Price" : "Precio de pieza", selfSource.cheapestPrice != null ? `$${selfSource.cheapestPrice.toFixed(2)}` : "—", "#f1f5f9"],
              [isEn ? "Part #" : "Núm. pieza", selfSource.cheapestPartNumber || "—", "#93c5fd"],
              [isEn ? "Round Trip" : "Viaje ida y vuelta", selfSource.roundTripMiles != null ? `${selfSource.roundTripMiles} mi · ${selfSource.roundTripMinutes} min` : "—", "#e2e8f0"],
              [isEn ? "Gas Cost" : "Costo de gasolina", selfSource.gasCost != null ? `$${selfSource.gasCost.toFixed(2)}` : "—", "#fbbf24"],
              [isEn ? "Total Cost to Self-Source" : "Costo total si lo compras tú", selfSource.cheapestPrice != null && selfSource.gasCost != null ? `$${(selfSource.cheapestPrice + selfSource.gasCost).toFixed(2)}` : "—", selfSource.worthIt ? "#4ade80" : "#f87171"],
            ].map(([label, val, color]) => (
              <div key={label} style={{ background: "#ffffff0a", borderRadius: 8, padding: "10px 12px" }}>
                <div style={{ fontSize: 9, color: "#64748b", marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color }}>{val}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <span style={{ fontSize: 22 }}>{selfSource.worthIt ? "✅" : "❌"}</span>
            <div>
              <div style={{ fontWeight: 700, color: selfSource.worthIt ? "#4ade80" : "#f87171", fontSize: 13, marginBottom: 2 }}>
                {selfSource.worthIt ? (isEn ? "Worth it — customer saves money buying the part" : "Vale la pena — el cliente ahorra comprando la pieza") : (isEn ? "Not worth it — shop sourcing is the better deal" : "No vale la pena — que el taller consiga la pieza")}
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>{selfSource.verdict}</div>
              <div style={{ fontSize: 10, color: "#64748b", marginTop: 6 }}>
                ⛽ ${selfSource.gasPrice?.toFixed(2)}/gal · {selfSource.mpg} mpg
                {selfSource.worthIt && <span style={{ marginLeft: 8, color: "#64748b" }}>
                  {isEn ? "· Note: some shops charge more labor when customer supplies parts" : "· Nota: algunos talleres cobran más mano de obra si el cliente trae piezas"}
                </span>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Online Retailers ── */}
      {hasSearched && (
        <>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "#64748b", marginBottom: 8, marginTop: 8, borderTop: "1px solid #1e2d47", paddingTop: 16 }}>
            🌐 {isEn ? "Online Retailers" : "Tiendas en línea"}
            <span style={{ fontWeight: 400, marginLeft: 8, textTransform: "none", fontSize: 10, color: "#475569" }}>
              {isEn ? "Top 5 results — click to order" : "Top 5 resultados — clic para ordenar"}
            </span>
          </div>
          {onlineResults.length === 0
            ? <p style={{ fontSize: 12, color: "#64748b" }}>{isEn ? "No online results found." : "Sin resultados en línea."}</p>
            : onlineResults.map((p, i) => (
              <div key={i} style={{ background: "#0a1020", border: "1px solid #1e2d47", borderRadius: 8, padding: "12px 14px", marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: "#e2e8f0", fontSize: 13 }}>{p.seller}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{p.part}</div>
                    {p.partNumber && (
                      <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>
                        {isEn ? "Part #" : "Núm. pieza"}: <span style={{ color: "#93c5fd" }}>{p.partNumber}</span>
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 12, marginTop: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 10, color: p.inStock ? "#22c55e" : "#ef4444", fontWeight: 700 }}>
                        {p.inStock ? (isEn ? "✓ In Stock" : "✓ En stock") : (isEn ? "✗ Out of Stock" : "✗ Sin existencias")}
                      </span>
                      <span style={{ fontSize: 10, color: "#94a3b8" }}>🛡 {p.warranty}</span>
                      <span style={{ fontSize: 10, color: "#94a3b8" }}>🚚 {p.shipping}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "#f1f5f9" }}>{p.price}</div>
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "inline-block", marginTop: 6, padding: "5px 12px",
                        background: "#1d4ed8", color: "#fff", borderRadius: 5,
                        fontSize: 11, fontWeight: 700, textDecoration: "none",
                      }}
                    >
                      {isEn ? "Order Now →" : "Ordenar →"}
                    </a>
                  </div>
                </div>
              </div>
            ))
          }
        </>
      )}

      {callScript && (
        <CallScriptModal
          isEn={isEn}
          part={callScript.part}
          seller={callScript.seller}
          phone={callScript.phone}
          vehicle={callScript.vehicle}
          onClose={() => setCallScript(null)}
        />
      )}
      {verifyBatchId && (
        <PartsVerificationModal
          isEn={isEn}
          batchId={verifyBatchId}
          onClose={() => setVerifyBatchId(null)}
        />
      )}
    </section>
  );
}

function PartsVerificationModal({ isEn, batchId, parts, onClose }) {
  const [data, setData] = useState({ inquiries: [], done: 0, total: 0, complete: false });
  const pollRef = React.useRef(null);

  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const result = await getPartsInquiryBatch(batchId);
        if (!active) return;
        setData(result);
        if (!result.complete) pollRef.current = setTimeout(poll, 3000);
      } catch { /* retry */ if (!active) return; pollRef.current = setTimeout(poll, 5000); }
    };
    poll();
    return () => { active = false; clearTimeout(pollRef.current); };
  }, [batchId]);

  const statusIcon = (s) => {
    if (s === "completed") return null;
    if (s === "failed") return "✗";
    if (s === "calling") return "📞";
    return "⏳";
  };

  const grouped = {};
  for (const inq of data.inquiries) {
    if (!grouped[inq.partName]) grouped[inq.partName] = [];
    grouped[inq.partName].push(inq);
  }

  return (
    <div className="modal-backdrop centered" onClick={onClose}>
      <section className="auth-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560, padding: 28 }}>
        <button className="drawer-close" onClick={onClose}><X /></button>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 22 }}>📞</span>
          <div>
            <h2 style={{ margin: 0, fontSize: 16 }}>{isEn ? "AI Parts Verification" : "Verificación de piezas con IA"}</h2>
            <p style={{ margin: 0, fontSize: 11, color: "#64748b" }}>
              {data.complete
                ? (isEn ? "All calls completed." : "Todas las llamadas completadas.")
                : (isEn ? `Calling stores… ${data.done}/${data.total} done` : `Llamando tiendas… ${data.done}/${data.total} listas`)}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ height: 4, background: "#1e2d47", borderRadius: 2, marginBottom: 20 }}>
          <div style={{ height: "100%", background: "#22c55e", borderRadius: 2, transition: "width .4s", width: data.total ? `${(data.done / data.total) * 100}%` : "0%" }} />
        </div>

        {Object.entries(grouped).map(([partName, inquiries]) => (
          <div key={partName} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: "#f97316", fontWeight: 700, marginBottom: 10, textTransform: "uppercase", letterSpacing: ".07em" }}>
              {partName}
            </div>
            {inquiries.map((inq) => (
              <div key={inq.id} style={{
                background: "#0d1829", border: `1px solid ${inq.status === "completed" && inq.hasPart ? "rgba(34,197,94,.3)" : inq.status === "completed" ? "rgba(239,68,68,.2)" : "#1e2d47"}`,
                borderRadius: 8, padding: "12px 14px", marginBottom: 8,
                display: "flex", alignItems: "flex-start", gap: 12,
              }}>
                <div style={{ fontSize: 18, flexShrink: 0, marginTop: 2 }}>
                  {inq.status === "completed"
                    ? (inq.hasPart ? "✅" : "❌")
                    : statusIcon(inq.status)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#f8fafc", marginBottom: 3 }}>{inq.storeName}</div>
                  {inq.status === "pending" && (
                    <div style={{ fontSize: 11, color: "#475569" }}>{isEn ? "Waiting to call…" : "Esperando llamada…"}</div>
                  )}
                  {inq.status === "calling" && (
                    <div style={{ fontSize: 11, color: "#60a5fa" }}>{isEn ? "On the line now…" : "En llamada ahora…"}</div>
                  )}
                  {inq.status === "completed" && inq.hasPart && (
                    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 2 }}>
                      {inq.quantity != null && <span style={{ fontSize: 11, color: "#22c55e" }}>{inq.quantity} {isEn ? "in stock" : "en stock"}</span>}
                      {inq.price && <span style={{ fontSize: 12, fontWeight: 700, color: "#f8fafc" }}>{inq.price}</span>}
                      {inq.pickupToday && <span style={{ fontSize: 10, background: "rgba(34,197,94,.12)", border: "1px solid rgba(34,197,94,.3)", color: "#22c55e", borderRadius: 4, padding: "1px 7px" }}>{isEn ? "Pickup today" : "Recogida hoy"}</span>}
                    </div>
                  )}
                  {inq.status === "completed" && !inq.hasPart && (
                    <div style={{ fontSize: 11, color: "#ef4444" }}>{isEn ? "Not in stock" : "Sin existencias"}</div>
                  )}
                  {inq.status === "failed" && (
                    <div style={{ fontSize: 11, color: "#f97316" }}>{isEn ? "Call could not be completed" : "No se pudo completar la llamada"}</div>
                  )}
                  {inq.summary && inq.status === "completed" && (
                    <div style={{ fontSize: 10, color: "#475569", marginTop: 6, lineHeight: 1.5 }}>{inq.summary}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}

        {data.complete && (
          <button className="primary full" onClick={onClose} style={{ marginTop: 8 }}>
            {isEn ? "Close" : "Cerrar"}
          </button>
        )}
      </section>
    </div>
  );
}

function CallScriptModal({ isEn, part, seller, phone, vehicle, onClose }) {
  const script = isEn
    ? `Hi, I'm calling about a part I need. I'm looking for:\n\n  Part: ${part}\n  Vehicle: ${vehicle || "— please specify year/make/model"}\n\nDo you have this in stock? If so, what's the current price and can I pick it up today?\n\nThank you!`
    : `Hola, estoy llamando por una pieza que necesito. Busco:\n\n  Pieza: ${part}\n  Vehículo: ${vehicle || "— especificar año/marca/modelo"}\n\n¿Tienen esto en inventario? Si es así, ¿cuál es el precio actual y puedo recogerla hoy?\n\n¡Gracias!`;
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(script); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  return (
    <div className="modal-backdrop centered" onClick={onClose}>
      <section className="auth-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <button className="drawer-close" onClick={onClose}><X /></button>
        <span className="eyebrow dark"><Phone size={14} /> {isEn ? "Call Script" : "Guion de llamada"}</span>
        <h2 style={{ marginBottom: 4 }}>{seller}</h2>
        <a href={`tel:${phone}`} style={{ fontSize: 13, color: "#22c55e", fontWeight: 700, display: "block", marginBottom: 16 }}>{phone}</a>
        <p style={{ fontSize: 11, color: "#64748b", marginBottom: 10 }}>
          {isEn ? "Read this when you call — or tap the number above to dial:" : "Lee esto cuando llames — o toca el número arriba para marcar:"}
        </p>
        <pre style={{
          background: "#0a1020", border: "1px solid #1e2d47", borderRadius: 8,
          padding: "14px 16px", fontSize: 12, color: "#e2e8f0", lineHeight: 1.7,
          whiteSpace: "pre-wrap", fontFamily: "inherit", marginBottom: 14,
        }}>{script}</pre>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="primary" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }} onClick={copy}>
            {copied ? <><Check size={14} /> {isEn ? "Copied!" : "¡Copiado!"}</> : <><Copy size={14} /> {isEn ? "Copy script" : "Copiar guion"}</>}
          </button>
          <a href={`tel:${phone}`} className="primary" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, textDecoration: "none" }}>
            <Phone size={14} /> {isEn ? "Call now" : "Llamar ahora"}
          </a>
        </div>
      </section>
    </div>
  );
}

const inputStyle = {
  width: "100%", marginTop: 4, background: "#0a1020", border: "1px solid #1e2d47",
  color: "#e2e8f0", padding: "9px 12px", borderRadius: 5, fontSize: 12,
  fontFamily: "inherit", outline: "none", display: "block",
};

const CARD_DARK = { background: "#0d1829", border: "1px solid #1e2d47", borderRadius: 10, padding: "16px 18px", marginBottom: 10 };
const TONE_COLOR = { danger: "#ef4444", warn: "#f97316", neutral: "#60a5fa" };

function DiagnosisResultCards({ result, lang, onAskFollowUp }) {
  const t = useT();
  const isEn = lang === "en";
  const [scoutQuote, setScoutQuote] = useState(null);
  const [scoutQuoteLoading, setScoutQuoteLoading] = useState(false);
  const [selectedOption, setSelectedOption] = useState("combo");
  const [sendOpen, setSendOpen] = useState(false);
  const [scenarioTab, setScenarioTab] = useState("best");
  const [verifyBatchId, setVerifyBatchId] = useState(null);
  const [verifyLoading, setVerifyLoading] = useState(false);

  const buildQuote = async () => {
    setScoutQuoteLoading(true);
    try {
      const q = await buildPartsQuote({ diagnosis: result, vehicle: {}, language: lang });
      setScoutQuote(q);
    } catch (e) { console.error(e); }
    finally { setScoutQuoteLoading(false); }
  };

  const hasBestWorst = result.bestCase || result.worstCase;

  return (
    <div style={{ marginTop: 20 }}>
      {/* Summary banner */}
      {result.summary && (
        <div style={{ ...CARD_DARK, border: "1px solid #334155", marginBottom: 14 }}>
          <p style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.65, margin: 0 }}>{result.summary}</p>
        </div>
      )}

      {/* Possible causes */}
      <div style={{ fontSize: 10, color: "#64748b", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 8 }}>
        {isEn ? "Possible Causes" : "Posibles causas"}
      </div>
      {result.possibleCauses?.map((c, i) => (
        <div key={c.title + i} style={{
          ...CARD_DARK,
          borderLeft: `3px solid ${TONE_COLOR[c.tone] ?? "#334155"}`,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
            <strong style={{ fontSize: 14, color: "#f8fafc", lineHeight: 1.4, flex: 1 }}>{c.title}</strong>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
              <span style={{
                fontSize: 11, fontWeight: 700, color: TONE_COLOR[c.tone] ?? "#64748b",
                background: `${TONE_COLOR[c.tone] ?? "#334155"}18`,
                border: `1px solid ${TONE_COLOR[c.tone] ?? "#334155"}44`,
                borderRadius: 4, padding: "2px 8px",
              }}>{c.probability}% {isEn ? "likely" : "probable"}</span>
              <span style={{ fontSize: 9, color: "#475569", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em" }}>{c.urgency}</span>
            </div>
          </div>
          <p style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.7, margin: "0 0 10px" }}>{c.reason}</p>
          {c.test && (
            <div style={{ fontSize: 11, color: "#60a5fa", display: "flex", alignItems: "flex-start", gap: 6, background: "rgba(96,165,250,.06)", border: "1px solid rgba(96,165,250,.15)", borderRadius: 6, padding: "8px 10px" }}>
              <Search size={12} style={{ flexShrink: 0, marginTop: 1 }} />
              <span><strong style={{ color: "#93c5fd" }}>{t("scoutVerify")}</strong> {c.test}</span>
            </div>
          )}
        </div>
      ))}

      {/* Estimate */}
      {result.estimate && (
        <div style={{ ...CARD_DARK, background: "#1a0d03", border: "1px solid rgba(249,115,22,.45)", marginTop: 4 }}>
          <div style={{ fontSize: 9, color: "#f97316", marginBottom: 6, letterSpacing: ".12em", fontWeight: 700, textTransform: "uppercase" }}>{t("scoutEstimate")}</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#fff", letterSpacing: "-1px" }}>
            ${result.estimate.low ?? "—"} – ${result.estimate.high ?? "—"}
          </div>
          <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 6, marginBottom: 8 }}>{result.estimate.repairLabel}</p>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {[
              [isEn ? "Parts" : "Piezas", `$${result.estimate.partsLow}–$${result.estimate.partsHigh}`],
              [isEn ? "Labor" : "Mano de obra", `$${result.estimate.laborLow}–$${result.estimate.laborHigh}`],
              [isEn ? "Labor hrs" : "Horas", `${result.estimate.laborHoursLow}–${result.estimate.laborHoursHigh}h`],
            ].map(([label, val]) => (
              <div key={label} style={{ fontSize: 11, color: "#64748b" }}>
                {label}: <span style={{ color: "#e2e8f0", fontWeight: 600 }}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Best case / Worst case */}
      {hasBestWorst && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 10, color: "#64748b", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 8 }}>
            {isEn ? "Scenarios" : "Escenarios"}
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            {result.bestCase && (
              <button onClick={() => setScenarioTab("best")} style={{
                padding: "5px 12px", borderRadius: 6, fontSize: 11, fontFamily: "inherit", cursor: "pointer",
                border: scenarioTab === "best" ? "1px solid #22c55e" : "1px solid #1e2d47",
                background: scenarioTab === "best" ? "rgba(34,197,94,.1)" : "transparent",
                color: scenarioTab === "best" ? "#22c55e" : "#64748b",
              }}>{isEn ? "Best case" : "Mejor caso"}</button>
            )}
            {result.worstCase && (
              <button onClick={() => setScenarioTab("worst")} style={{
                padding: "5px 12px", borderRadius: 6, fontSize: 11, fontFamily: "inherit", cursor: "pointer",
                border: scenarioTab === "worst" ? "1px solid #ef4444" : "1px solid #1e2d47",
                background: scenarioTab === "worst" ? "rgba(239,68,68,.1)" : "transparent",
                color: scenarioTab === "worst" ? "#ef4444" : "#64748b",
              }}>{isEn ? "Worst case" : "Peor caso"}</button>
            )}
          </div>
          {scenarioTab === "best" && result.bestCase && (
            <div style={{ ...CARD_DARK, border: "1px solid rgba(34,197,94,.25)" }}>
              <div style={{ fontSize: 11, color: "#22c55e", fontWeight: 700, marginBottom: 6 }}>{isEn ? "Best Case" : "Mejor caso"}</div>
              <div style={{ fontWeight: 600, fontSize: 13, color: "#f8fafc", marginBottom: 4 }}>{result.bestCase.scenario}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#22c55e", marginBottom: 6 }}>{result.bestCase.estimatedCost}</div>
              <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 4px", lineHeight: 1.6 }}>{result.bestCase.outcome}</p>
              <small style={{ fontSize: 10, color: "#475569" }}>{isEn ? "Timeframe:" : "Tiempo estimado:"} {result.bestCase.timeframe}</small>
            </div>
          )}
          {scenarioTab === "worst" && result.worstCase && (
            <div style={{ ...CARD_DARK, border: "1px solid rgba(239,68,68,.25)" }}>
              <div style={{ fontSize: 11, color: "#ef4444", fontWeight: 700, marginBottom: 6 }}>{isEn ? "Worst Case" : "Peor caso"}</div>
              <div style={{ fontWeight: 600, fontSize: 13, color: "#f8fafc", marginBottom: 4 }}>{result.worstCase.scenario}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#ef4444", marginBottom: 6 }}>{result.worstCase.estimatedCost}</div>
              <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 4px", lineHeight: 1.6 }}>{result.worstCase.outcome}</p>
              <small style={{ fontSize: 10, color: "#475569" }}>{isEn ? "Timeframe:" : "Tiempo estimado:"} {result.worstCase.timeframe}</small>
            </div>
          )}
        </div>
      )}

      {/* Follow-up questions */}
      {result.questions?.length > 0 && onAskFollowUp && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 10, color: "#64748b", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 8 }}>
            {isEn ? "Answer these for a better diagnosis" : "Responde para mejorar el diagnóstico"}
          </div>
          <div style={{ ...CARD_DARK, border: "1px solid #1e3a5f" }}>
            <p style={{ fontSize: 11, color: "#60a5fa", marginBottom: 12 }}>
              {isEn ? "The AI needs more info to narrow down the cause:" : "La IA necesita más información para precisar la causa:"}
            </p>
            {result.questions.map((q, qi) => (
              <div key={qi} style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 12, color: "#cbd5e1", display: "block", marginBottom: 5 }}>
                  {qi + 1}. {q}
                </label>
                <input
                  placeholder={isEn ? "Your answer…" : "Tu respuesta…"}
                  style={{ ...inputStyle, borderColor: "#1e3a5f" }}
                  onChange={(e) => onAskFollowUp(qi, e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Build quote */}
      <button
        className="primary full" style={{ marginTop: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
        onClick={buildQuote} disabled={scoutQuoteLoading}
      >
        {scoutQuoteLoading
          ? (isEn ? "Building quote…" : "Generando cotización…")
          : <><PackageSearch size={15} /> {isEn ? "Build Parts Quote" : "Generar cotización de piezas"}</>}
      </button>
      {scoutQuote && (
        <>
          <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
            <QuoteCard option={scoutQuote.quotes.combo} selected={selectedOption === "combo"} onSelect={() => setSelectedOption("combo")} lang={lang} />
            <QuoteCard option={scoutQuote.quotes.single} selected={selectedOption === "single"} onSelect={() => setSelectedOption("single")} lang={lang} />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <button className="primary" style={{ display: "flex", alignItems: "center", gap: 8 }} onClick={() => setSendOpen(true)}>
              <Send size={15} /> {isEn ? "Send Quote to Customer" : "Enviar cotización al cliente"}
            </button>
            <button
              className="primary"
              disabled={verifyLoading}
              onClick={async () => {
                setVerifyLoading(true);
                try {
                  const demoP = isEn ? partsResultsEn : partsResults;
                  const quoteParts = scoutQuote?.quotes?.combo?.parts || [];
                  const partName = quoteParts[0]?.name || result?.estimate?.repairLabel || (isEn ? "Auto part" : "Pieza automotriz");
                  const vehicleStr = scoutQuote?.vehicle ? `${scoutQuote.vehicle.year || ""} ${scoutQuote.vehicle.make || ""} ${scoutQuote.vehicle.model || ""}`.trim() : "";
                  const stores = demoP.filter((p) => p.phone).map((p) => ({ name: p.seller, phone: p.phone }));
                  if (!stores.length) { setVerifyLoading(false); return; }
                  const { batchId } = await startPartsVerification({ lang, parts: [{ partName, vehicle: vehicleStr || undefined, stores }] });
                  setVerifyBatchId(batchId);
                } catch (e) { console.error(e); }
                finally { setVerifyLoading(false); }
              }}
              style={{ display: "flex", alignItems: "center", gap: 8, background: "#1d4ed8" }}
            >
              <Phone size={15} />
              {verifyLoading ? (isEn ? "Starting calls…" : "Iniciando…") : (isEn ? "Verify via AI calls" : "Verificar con IA")}
            </button>
          </div>
          {sendOpen && (
            <SendQuoteModal
              quoteData={scoutQuote}
              selectedOption={selectedOption}
              vehicle={scoutQuote.vehicle}
              lang={lang}
              onClose={() => setSendOpen(false)}
              onSent={() => {}}
            />
          )}
          {verifyBatchId && (
            <PartsVerificationModal
              isEn={isEn}
              batchId={verifyBatchId}
              onClose={() => setVerifyBatchId(null)}
            />
          )}
        </>
      )}
    </div>
  );
}

function ScoutPanel() {
  const { lang } = useLang();
  const t = useT();
  const isEn = lang === "en";
  const [mode, setMode] = useState("ai");
  const [vehicle, setVehicle] = useState({ year: "2019", make: "Honda", model: "Accord" });
  const [mileage, setMileage] = useState("62,000");

  // AI mode state
  const [query, setQuery] = useState("");
  const [aiResult, setAiResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [answers, setAnswers] = useState({});
  const [refining, setRefining] = useState(false);

  // Manual mode state
  const [causes, setCauses] = useState([
    { title: "", reason: "", test: "", probability: 80 },
    { title: "", reason: "", test: "", probability: 50 },
  ]);
  const [laborLow, setLaborLow] = useState("1.5");
  const [laborHigh, setLaborHigh] = useState("3");
  const [manualResult, setManualResult] = useState(null);

  const runAI = async () => {
    if (!query.trim()) return;
    setLoading(true); setAiResult(null); setAnswers({});
    try {
      const r = await createDiagnosis({ vehicle, mileage, description: query, zip: "95814", language: lang });
      setAiResult(r);
    } catch (e) { setAiResult({ error: e.message }); }
    finally { setLoading(false); }
  };

  const refineAI = async () => {
    const followUpText = Object.entries(answers)
      .filter(([, v]) => v.trim())
      .map(([qi, v]) => `Q: ${aiResult.questions[Number(qi)]} A: ${v}`)
      .join("\n");
    if (!followUpText) return;
    setRefining(true);
    try {
      const refinedDesc = `${query}\n\nFollow-up answers:\n${followUpText}`;
      const r = await createDiagnosis({ vehicle, mileage, description: refinedDesc, zip: "95814", language: lang });
      setAiResult(r);
      setAnswers({});
    } catch (e) { setAiResult({ error: e.message }); }
    finally { setRefining(false); }
  };

  const handleAnswerChange = (qi, val) => setAnswers((prev) => ({ ...prev, [qi]: val }));

  const runManual = () => {
    const filledCauses = causes.filter((c) => c.title.trim());
    if (!filledCauses.length) return;
    setManualResult({
      summary: filledCauses[0].title,
      source: "manual",
      possibleCauses: filledCauses.map((c, i) => ({
        ...c, probability: c.probability || (80 - i * 20), urgency: isEn ? "Verify" : "Verificar", tone: i === 0 ? "warn" : "neutral",
      })),
      estimate: {
        low: 0, high: 0, repairLabel: filledCauses[0].title,
        laborHoursLow: Number(laborLow) || 1.5,
        laborHoursHigh: Number(laborHigh) || 3,
      },
    });
  };

  const VehicleInputs = () => (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 8, marginBottom: 12 }}>
      {[[t("scoutYear"), "year"], [t("scoutMake"), "make"], [t("scoutModel"), "model"]].map(([label, key]) => (
        <label key={key} style={{ fontSize: 10, color: "#64748b" }}>
          {label}
          <input value={vehicle[key]} onChange={(e) => setVehicle((v) => ({ ...v, [key]: e.target.value }))} style={inputStyle} />
        </label>
      ))}
      <label style={{ fontSize: 10, color: "#64748b" }}>
        {isEn ? "Mileage" : "Millaje"}
        <input value={mileage} onChange={(e) => setMileage(e.target.value)} style={inputStyle} />
      </label>
    </div>
  );

  return (
    <section className="panel">
      <div className="panel-title">
        <div>
          <span className="eyebrow dark"><Sparkles size={14} /> {t("scoutEyebrow")}</span>
          <h2>{t("scoutTitle")}</h2>
          <p>{t("scoutDesc")}</p>
        </div>
      </div>
      <div style={{ padding: "0 20px 24px" }}>

      {/* Mode toggle */}
      <div style={{ display: "flex", gap: 6, marginBottom: 18, borderBottom: "1px solid #1e2d47", paddingBottom: 14 }}>
        {[["ai", <><Bot size={14} /> {isEn ? "AI Diagnosis" : "Diagnóstico IA"}</>],
          ["manual", <><Wrench size={14} /> {isEn ? "Manual Entry" : "Entrada manual"}</>]
        ].map(([key, label]) => (
          <button
            key={key} onClick={() => setMode(key)}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "7px 14px",
              borderRadius: 6, border: mode === key ? "1px solid #f97316" : "1px solid #1e2d47",
              background: mode === key ? "rgba(249,115,22,.1)" : "transparent",
              color: mode === key ? "#f97316" : "#64748b", cursor: "pointer", fontSize: 12, fontFamily: "inherit",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <VehicleInputs />

      {mode === "ai" ? (
        <>
          <textarea
            value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder={t("scoutPlaceholder")} rows={4}
            style={{ ...inputStyle, resize: "vertical", marginBottom: 12, padding: "12px 14px" }}
          />
          <button className="primary full" onClick={runAI} disabled={loading || !query.trim()} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {loading ? t("scoutAnalyzing") : <><Bot size={16} /> {t("scoutBtn")}</>}
          </button>
          {aiResult && !aiResult.error && (
            <>
              <DiagnosisResultCards result={aiResult} lang={lang} onAskFollowUp={handleAnswerChange} />
              {aiResult.questions?.length > 0 && Object.values(answers).some((v) => v.trim()) && (
                <button
                  className="primary full"
                  onClick={refineAI}
                  disabled={refining}
                  style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#1d4ed8" }}
                >
                  {refining
                    ? (isEn ? "Refining diagnosis…" : "Refinando diagnóstico…")
                    : <><Sparkles size={15} /> {isEn ? "Refine my diagnosis with these answers →" : "Refinar diagnóstico con estas respuestas →"}</>}
                </button>
              )}
            </>
          )}
          {aiResult?.error && <p className="form-error" style={{ marginTop: 12 }}>{aiResult.error}</p>}
        </>
      ) : (
        <>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 10 }}>
            {isEn ? "Enter your findings. Leave blank rows unused." : "Ingresa tus hallazgos. Deja las filas en blanco sin usar."}
          </div>
          {causes.map((c, i) => (
            <div key={i} style={{ marginBottom: 14, padding: "12px 14px", border: "1px solid #1e2d47", borderRadius: 8, background: "#0a1020" }}>
              <div style={{ fontSize: 10, color: "#f97316", fontWeight: 600, marginBottom: 8 }}>
                {isEn ? `Finding ${i + 1}${i === 0 ? " (Primary)" : ""}` : `Hallazgo ${i + 1}${i === 0 ? " (Principal)" : ""}`}
              </div>
              {[
                [isEn ? "Cause / finding *" : "Causa / hallazgo *", "title", isEn ? "e.g. Worn front brake pads" : "ej. Pastillas de freno desgastadas"],
                [isEn ? "Why / evidence" : "Por qué / evidencia", "reason", isEn ? "e.g. Squealing noise, pad thickness < 2mm" : "ej. Rechinido, espesor < 2mm"],
                [isEn ? "Test / procedure" : "Prueba / procedimiento", "test", isEn ? "e.g. Measure pad thickness and rotor runout" : "ej. Medir espesor y desviación del rotor"],
              ].map(([label, field, ph]) => (
                <label key={field} style={{ fontSize: 10, color: "#64748b", display: "block", marginBottom: 6 }}>
                  {label}
                  <input
                    value={c[field]} placeholder={ph}
                    onChange={(e) => setCauses((cs) => cs.map((x, j) => j === i ? { ...x, [field]: e.target.value } : x))}
                    style={inputStyle}
                  />
                </label>
              ))}
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            {[[isEn ? "Labor hours (min)" : "Horas mano de obra (mín)", laborLow, setLaborLow],
              [isEn ? "Labor hours (max)" : "Horas mano de obra (máx)", laborHigh, setLaborHigh]
            ].map(([label, val, setter]) => (
              <label key={label} style={{ flex: 1, fontSize: 10, color: "#64748b" }}>
                {label}
                <input type="number" value={val} min="0.5" max="20" step="0.5"
                  onChange={(e) => setter(e.target.value)} style={inputStyle} />
              </label>
            ))}
          </div>
          <button
            className="primary full"
            onClick={runManual}
            disabled={!causes[0].title.trim()}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
          >
            <PackageSearch size={16} /> {isEn ? "Generate Parts Quote" : "Generar cotización de piezas"}
          </button>
          {manualResult && <DiagnosisResultCards result={manualResult} lang={lang} />}
        </>
      )}
      </div>
    </section>
  );
}

function BookingModal({ onClose }) {
  const t = useT();
  const [form, setForm] = useState({ customer: "", vehicle: "", service: "", time: "", tech: "", notes: "" });
  const [saved, setSaved] = useState(false);

  const book = () => {
    if (!form.customer || !form.service || !form.time) return;
    setSaved(true);
    setTimeout(onClose, 1400);
  };

  const field = (label, key, placeholder, type = "text") => (
    <label key={key} style={{ fontSize: 10, color: "#64748b" }}>
      {label}
      <input
        type={type} value={form[key]} placeholder={placeholder}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        style={{
          width: "100%", marginTop: 4, background: "#0a1020", border: "1px solid #1e2d47",
          color: "#e2e8f0", padding: "10px 14px", borderRadius: 4, fontSize: 12,
          fontFamily: "inherit", outline: "none", display: "block",
        }}
      />
    </label>
  );

  return (
    <div className="modal-backdrop centered" onClick={onClose}>
      <section className="auth-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <button className="drawer-close" onClick={onClose}><X /></button>
        <span className="eyebrow dark"><Calendar size={15} /> {t("bookingEyebrow")}</span>
        <h2>{t("bookingTitle")}</h2>
        {saved ? (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <div style={{ color: "#4ade80", fontWeight: 600, fontSize: 14 }}>{t("bookingConfirmed")}</div>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {field(t("customerLabel"), "customer", t("customerPlaceholder"))}
              {field(t("vehicleLabel"), "vehicle", t("vehiclePlaceholder"))}
              {field(t("serviceLabel"), "service", t("servicePlaceholder"))}
              {field(t("timeLabel"), "time", t("timePlaceholder"))}
              {field(t("techLabel"), "tech", t("techPlaceholder"))}
              <label style={{ fontSize: 10, color: "#64748b" }}>
                {t("notesLabel")}
                <textarea
                  value={form.notes} rows={2}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder={t("notesPlaceholder")}
                  style={{
                    width: "100%", marginTop: 4, background: "#0a1020", border: "1px solid #1e2d47",
                    color: "#e2e8f0", padding: "10px 14px", borderRadius: 4, fontSize: 12,
                    fontFamily: "inherit", outline: "none", resize: "vertical", display: "block",
                  }}
                />
              </label>
            </div>
            <button
              className="primary full" style={{ marginTop: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              onClick={book} disabled={!form.customer || !form.service || !form.time}
            >
              <Calendar size={16} /> {t("confirmApptBtn")}
            </button>
          </>
        )}
      </section>
    </div>
  );
}

function MessageModal({ request, onClose }) {
  const t = useT();
  const { lang } = useLang();
  const [msg, setMsg] = useState("");
  const [sent, setSent] = useState(false);

  const send = () => {
    if (!msg.trim()) return;
    setSent(true);
    setTimeout(onClose, 1400);
  };

  return (
    <div className="modal-backdrop centered" onClick={onClose}>
      <section className="auth-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <button className="drawer-close" onClick={onClose}><X /></button>
        <span className="eyebrow dark"><MessageSquareText size={15} /> {t("msgEyebrow")}</span>
        <h2>{request?.customer || (lang === "en" ? "Customer" : "Cliente")}</h2>
        <p style={{ fontSize: 11, color: "#64748b", marginBottom: 16 }}>{request?.vehicle} · {request?.distance}</p>
        {sent ? (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✉️</div>
            <div style={{ color: "#4ade80", fontWeight: 600, fontSize: 14 }}>{t("msgSent")}</div>
          </div>
        ) : (
          <>
            <textarea
              value={msg} rows={5}
              onChange={(e) => setMsg(e.target.value)}
              placeholder={t("msgPlaceholder")}
              style={{
                width: "100%", background: "#0a1020", border: "1px solid #1e2d47",
                color: "#e2e8f0", padding: "12px 14px", borderRadius: 6, fontSize: 12,
                fontFamily: "inherit", outline: "none", resize: "vertical",
              }}
            />
            <button
              className="primary full" style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              onClick={send} disabled={!msg.trim()}
            >
              {t("sendBtn")} <ArrowRight size={16} />
            </button>
          </>
        )}
      </section>
    </div>
  );
}

/* ── Parts quote components ── */

const REPAIR_STAGES = [
  "Quote Sent",
  "Approved",
  "Parts Ordered",
  "Parts In Transit",
  "Parts Arrived",
  "In Progress",
  "Quality Check",
  "Ready for Pickup",
  "Completed",
  "Invoice Sent",
  "Paid",
];

const STAGE_LABELS = {
  es: {
    "Quote Sent":        "Cotización enviada",
    "Approved":          "Aprobada",
    "Parts Ordered":     "Piezas pedidas",
    "Parts In Transit":  "Piezas en tránsito",
    "Parts Arrived":     "Piezas llegaron",
    "In Progress":       "En proceso",
    "Quality Check":     "Control de calidad",
    "Ready for Pickup":  "Lista para recoger",
    "Completed":         "Completada",
    "Invoice Sent":      "Factura enviada",
    "Paid":              "Pagada",
  },
  en: {
    "Quote Sent":        "Quote Sent",
    "Approved":          "Approved",
    "Parts Ordered":     "Parts Ordered",
    "Parts In Transit":  "Parts In Transit",
    "Parts Arrived":     "Parts Arrived",
    "In Progress":       "In Progress",
    "Quality Check":     "Quality Check",
    "Ready for Pickup":  "Ready for Pickup",
    "Completed":         "Completed",
    "Invoice Sent":      "Invoice Sent",
    "Paid":              "Paid",
  },
};

function fmt(n) { return n != null ? `$${Number(n).toFixed(2)}` : "—"; }

function QuoteCard({ option, selected, onSelect, lang }) {
  const isEn = lang === "en";
  const [expanded, setExpanded] = useState(false);
  if (!option) return null;
  const isCombo = option.storeCount > 1;
  const accentColor = isCombo ? "#f97316" : "#38bdf8";

  return (
    <article style={{
      border: selected ? `1.5px solid ${accentColor}` : "1px solid #1e2d47",
      borderRadius: 10, padding: "18px 20px", background: "#0c1524",
      flex: 1, minWidth: 260, display: "flex", flexDirection: "column", gap: 10,
      position: "relative",
    }}>
      {selected && (
        <span style={{
          position: "absolute", top: -10, left: 18,
          background: accentColor, color: "#fff", fontSize: 9,
          fontWeight: 700, letterSpacing: ".08em", padding: "3px 10px", borderRadius: 20,
        }}>{isEn ? "SELECTED" : "SELECCIONADO"}</span>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>{option.label}</div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{option.description}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: accentColor }}>
            {fmt(option.totalLow)}–{fmt(option.totalHigh)}
          </div>
          <div style={{ fontSize: 10, color: "#475569" }}>{isEn ? "est. total" : "total est."}</div>
        </div>
      </div>

      {/* Cost breakdown */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11 }}>
        {[
          [isEn ? "Parts" : "Piezas", fmt(option.partsCost)],
          [isEn ? "Labor (est.)" : "Mano de obra (est.)", `${fmt(option.laborLow)}–${fmt(option.laborHigh)}`],
          [isEn ? "Tax (est.)" : "Impuesto (est.)", `${fmt(option.taxLow)}–${fmt(option.taxHigh)}`],
        ].map(([label, value]) => (
          <div key={label} style={{ display: "flex", justifyContent: "space-between", color: "#64748b" }}>
            <span>{label}</span><strong style={{ color: "#94a3b8" }}>{value}</strong>
          </div>
        ))}
      </div>

      {/* Store info */}
      {option.storeName && (
        <div style={{
          background: "rgba(56,189,248,.05)", border: "1px solid rgba(56,189,248,.1)",
          borderRadius: 6, padding: "8px 12px", fontSize: 11, color: "#38bdf8",
        }}>
          <Store size={13} style={{ marginRight: 5, verticalAlign: "middle" }} />
          {isEn ? "All from" : "Todo de"} <strong>{option.storeName}</strong>
        </div>
      )}
      {isCombo && (
        <div style={{
          background: "rgba(249,115,22,.05)", border: "1px solid rgba(249,115,22,.1)",
          borderRadius: 6, padding: "8px 12px", fontSize: 11, color: "#f97316",
        }}>
          <PackageSearch size={13} style={{ marginRight: 5, verticalAlign: "middle" }} />
          {isEn ? `Best price from ${option.storeCount} stores` : `Mejor precio de ${option.storeCount} tiendas`}
        </div>
      )}

      {/* Expand/collapse parts list */}
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          background: "transparent", border: "1px solid #1e2d47", color: "#64748b",
          borderRadius: 6, padding: "6px 12px", fontSize: 11, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          fontFamily: "inherit",
        }}
      >
        <PackageSearch size={13} />
        {expanded
          ? (isEn ? "Hide parts list" : "Ocultar lista de piezas")
          : (isEn ? "View parts list" : "Ver lista de piezas")}
        <ChevronDown size={13} style={{ transform: expanded ? "rotate(180deg)" : "", transition: ".2s" }} />
      </button>

      {expanded && (
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          <div style={{
            display: "grid", gridTemplateColumns: "1fr auto auto", gap: "4px 12px",
            fontSize: 10, color: "#475569", fontWeight: 600, letterSpacing: ".06em",
            padding: "6px 0", borderBottom: "1px solid #1e2d47", marginBottom: 4,
          }}>
            <span>{isEn ? "PART" : "PIEZA"}</span>
            <span style={{ textAlign: "right" }}>{isEn ? "STORE" : "TIENDA"}</span>
            <span style={{ textAlign: "right" }}>{isEn ? "PRICE" : "PRECIO"}</span>
          </div>
          {(option.lineItems || []).map((item) => (
            <div key={item.partKey} style={{
              display: "grid", gridTemplateColumns: "1fr auto auto",
              gap: "2px 12px", padding: "6px 0", borderBottom: "1px solid #0e1a2e",
              fontSize: 11, alignItems: "start",
            }}>
              <div>
                <div style={{ color: "#cbd5e1" }}>{lang === "en" ? item.nameEn : item.nameEs}</div>
                {item.partNumber && (
                  <div style={{ fontSize: 9, color: "#334155", marginTop: 1 }}>#{item.partNumber}</div>
                )}
                <div style={{ fontSize: 9, color: "#475569", marginTop: 1 }}>{item.availability}</div>
              </div>
              <div style={{ textAlign: "right", color: "#64748b", fontSize: 10, whiteSpace: "nowrap", paddingTop: 2 }}>
                {item.storeName.split(" ")[0]}
              </div>
              <div style={{ textAlign: "right", color: "#94a3b8", fontWeight: 600, whiteSpace: "nowrap", paddingTop: 2 }}>
                {fmt(item.totalPrice)}
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        className={selected ? "requested full" : "primary full"}
        onClick={onSelect}
        style={{ marginTop: "auto" }}
      >
        {selected ? <><Check size={15} /> {isEn ? "Selected" : "Seleccionada"}</> : (isEn ? "Select this quote" : "Seleccionar esta cotización")}
      </button>
    </article>
  );
}

function SendQuoteModal({ quoteData, selectedOption, vehicle, onClose, onSent, lang }) {
  const isEn = lang === "en";
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const selectedQ = selectedOption === "single" ? quoteData?.quotes?.single : quoteData?.quotes?.combo;

  const send = async () => {
    if (!form.name.trim()) { setError(isEn ? "Enter customer name." : "Ingresa el nombre del cliente."); return; }
    if (!form.email.trim()) {
      setError(isEn ? "Enter the customer email address." : "Ingresa el correo electrónico del cliente."); return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await sendItemizedQuote({
        diagnosis: quoteData.diagnosis,
        vehicle: vehicle || quoteData.vehicle,
        quoteCombo: quoteData.quotes.combo,
        quoteSingle: quoteData.quotes.single,
        customer: { name: form.name, email: form.email || undefined, phone: form.phone || undefined },
        language: lang,
      });
      setResult(res);
      onSent?.(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop centered" onClick={onClose}>
      <section className="auth-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <button className="drawer-close" onClick={onClose}><X /></button>
        <span className="eyebrow dark"><Send size={14} /> {isEn ? "Send Quote to Customer" : "Enviar cotización al cliente"}</span>
        <h2 style={{ fontSize: 17, marginBottom: 8 }}>
          {isEn ? "How should we send it?" : "¿Cómo lo enviamos?"}
        </h2>

        {result ? (
          <div style={{ textAlign: "center", padding: "12px 0" }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
            <div style={{ color: "#4ade80", fontWeight: 700, fontSize: 15, marginBottom: 6 }}>
              {isEn ? "Quote sent!" : "¡Cotización enviada!"}
            </div>
            <p style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>
              {isEn
                ? "Share this link with the customer — they can view and approve the quote."
                : "Comparte este enlace con el cliente para que revise y apruebe la cotización."}
            </p>
            <div style={{
              background: "#0a1020", border: "1px solid #1e2d47", borderRadius: 6,
              padding: "10px 14px", fontSize: 11, color: "#94a3b8", wordBreak: "break-all",
              textAlign: "left", marginBottom: 10,
            }}>
              {result.trackUrl}
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <button
                className="primary" style={{ flex: 1 }}
                onClick={() => navigator.clipboard?.writeText(result.trackUrl)}
              >
                {isEn ? "Copy Link" : "Copiar enlace"}
              </button>
              <button
                className="outline" style={{ flex: 1 }}
                onClick={() => window.open(result.trackUrl, "_blank")}
              >
                {isEn ? "Open Tracker" : "Abrir seguimiento"}
              </button>
            </div>
            <button className="outline full" onClick={onClose}>{isEn ? "Close" : "Cerrar"}</button>
          </div>
        ) : (
          <>
            {selectedQ && (
              <div style={{
                background: "rgba(249,115,22,.05)", border: "1px solid rgba(249,115,22,.12)",
                borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 12,
              }}>
                <div style={{ color: "#f97316", fontWeight: 700 }}>{selectedQ.label}</div>
                <div style={{ color: "#94a3b8" }}>{isEn ? "Total est." : "Total est."} {fmt(selectedQ.totalLow)}–{fmt(selectedQ.totalHigh)}</div>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                [isEn ? "Customer name *" : "Nombre del cliente *", "name", "text", isEn ? "Full name" : "Nombre completo"],
                [isEn ? "Email address * (default)" : "Correo electrónico * (predeterminado)", "email", "email", "cliente@correo.com"],
                [isEn ? "Mobile phone (optional SMS)" : "Teléfono celular (SMS opcional)", "phone", "tel", "(555) 123-4567"],
              ].map(([label, key, type, ph]) => (
                <label key={key} style={{ fontSize: 10, color: "#64748b" }}>
                  {label}
                  <input
                    type={type} value={form[key]} placeholder={ph}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    style={{
                      width: "100%", marginTop: 4, background: "#0a1020", border: "1px solid #1e2d47",
                      color: "#e2e8f0", padding: "10px 14px", borderRadius: 4, fontSize: 12,
                      fontFamily: "inherit", outline: "none", display: "block",
                    }}
                  />
                </label>
              ))}
            </div>
            <div style={{ fontSize: 11, color: "#475569", marginTop: 8, display: "flex", gap: 12 }}>
              <span><Mail size={12} style={{ verticalAlign: "middle" }} /> {isEn ? "Email is the default delivery method" : "El correo es el método de envío predeterminado"}</span>
              {form.phone && <span><Phone size={12} style={{ verticalAlign: "middle" }} /> {isEn ? "SMS will also be attempted" : "También se intentará enviar SMS"}</span>}
            </div>
            {error && <p className="form-error" style={{ marginTop: 8 }}>{error}</p>}
            <button
              className="primary full" style={{ marginTop: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              onClick={send} disabled={loading}
            >
              {loading ? (isEn ? "Sending…" : "Enviando…") : <><Send size={15} /> {isEn ? "Send Quote" : "Enviar cotización"}</>}
            </button>
          </>
        )}
      </section>
    </div>
  );
}

function TrackPage({ token }) {
  const { lang } = useLang();
  const isEn = lang === "en";
  const stageLabelMap = STAGE_LABELS[isEn ? "en" : "es"];
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState(false);

  useEffect(() => {
    getTrackingInfo(token)
      .then(({ quote: q }) => { setQuote(q); setApproved(q.customerApproved); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const approve = async () => {
    setApproving(true);
    try {
      const { quote: q } = await approveRepairQuote(token);
      setQuote(q); setApproved(true);
    } catch (e) { setError(e.message); }
    finally { setApproving(false); }
  };

  const stageIndex = quote ? REPAIR_STAGES.indexOf(quote.repairStage) : -1;
  const displayedQ = quote?.quoteSingle || quote?.quoteCombo;
  const veh = quote?.vehicle || {};

  return (
    <main className="legal-page" style={{ minHeight: "100vh" }}>
      <section className="legal-card" style={{ maxWidth: 640 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
          <span style={{
            background: "#1e3a5f", borderRadius: 8, padding: "6px 10px",
            color: "#f97316", display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700,
          }}>
            <Wrench size={16} /> RepairScout
          </span>
          <span style={{ fontSize: 12, color: "#475569" }}>
            {isEn ? "Repair Status Tracker" : "Seguimiento de reparación"}
          </span>
        </div>

        {loading && (
          <div style={{ textAlign: "center", padding: "48px 0", color: "#475569" }}>
            {isEn ? "Loading your quote…" : "Cargando tu cotización…"}
          </div>
        )}

        {error && (
          <div style={{ textAlign: "center", padding: "48px 0" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
            <div style={{ color: "#f87171", fontWeight: 600, marginBottom: 8 }}>
              {isEn ? "Quote not found" : "Cotización no encontrada"}
            </div>
            <p style={{ fontSize: 12, color: "#64748b" }}>{error}</p>
          </div>
        )}

        {quote && (
          <>
            {/* Vehicle header */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, color: "#f97316", fontWeight: 600, letterSpacing: ".08em", marginBottom: 4 }}>
                {isEn ? "YOUR VEHICLE" : "TU VEHÍCULO"}
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9", margin: 0 }}>
                {[veh.year, veh.make, veh.model].filter(Boolean).join(" ") || (isEn ? "Your Vehicle" : "Tu vehículo")}
              </h1>
              <p style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                {isEn ? "Repair quote for" : "Cotización de reparación para"} <strong style={{ color: "#94a3b8" }}>{quote.customerName}</strong>
              </p>
            </div>

            {/* Approval banner */}
            {!approved && quote.repairStage === "Quote Sent" && (
              <div style={{
                background: "rgba(249,115,22,.06)", border: "1px solid rgba(249,115,22,.3)",
                borderRadius: 10, padding: "16px 20px", marginBottom: 24,
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap",
              }}>
                <div>
                  <div style={{ fontWeight: 700, color: "#f97316", fontSize: 14 }}>
                    {isEn ? "Ready for your approval" : "Lista para tu aprobación"}
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                    {isEn ? "Review the quote below and approve to move forward." : "Revisa la cotización y aprueba para continuar."}
                  </div>
                </div>
                <button
                  className="primary"
                  onClick={approve}
                  disabled={approving}
                  style={{ whiteSpace: "nowrap" }}
                >
                  {approving ? "…" : <><Check size={15} /> {isEn ? "Approve Quote" : "Aprobar cotización"}</>}
                </button>
              </div>
            )}

            {approved && (
              <div style={{
                background: "rgba(74,222,128,.06)", border: "1px solid rgba(74,222,128,.3)",
                borderRadius: 10, padding: "14px 18px", marginBottom: 24, textAlign: "center",
              }}>
                <Check size={18} style={{ color: "#4ade80", marginBottom: 4 }} />
                <div style={{ color: "#4ade80", fontWeight: 700, fontSize: 14 }}>
                  {isEn ? "Quote approved! Your shop will contact you shortly." : "¡Cotización aprobada! Tu taller se pondrá en contacto contigo pronto."}
                </div>
              </div>
            )}

            {/* Status timeline */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, letterSpacing: ".08em", marginBottom: 14 }}>
                {isEn ? "REPAIR TIMELINE" : "PROGRESO DE REPARACIÓN"}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {REPAIR_STAGES.map((stage, idx) => {
                  const done = idx < stageIndex;
                  const current = idx === stageIndex;
                  const future = idx > stageIndex;
                  return (
                    <div key={stage} style={{ display: "flex", alignItems: "flex-start", gap: 14, paddingBottom: idx < REPAIR_STAGES.length - 1 ? 0 : 0 }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <div style={{
                          width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                          background: done ? "#4ade80" : current ? "#f97316" : "#0e1a2e",
                          border: done ? "none" : current ? "2px solid #f97316" : "1.5px solid #1e2d47",
                          flexShrink: 0,
                        }}>
                          {done ? <Check size={13} color="#0a1020" /> : current ? <span style={{ fontSize: 9, color: "#f97316", fontWeight: 700 }}>●</span> : null}
                        </div>
                        {idx < REPAIR_STAGES.length - 1 && (
                          <div style={{ width: 1, height: 28, background: done ? "#4ade80" : "#1e2d47", margin: "3px 0" }} />
                        )}
                      </div>
                      <div style={{ paddingTop: 3, paddingBottom: 12 }}>
                        <div style={{
                          fontSize: 13, fontWeight: current ? 700 : done ? 600 : 400,
                          color: done ? "#4ade80" : current ? "#f97316" : "#334155",
                        }}>
                          {stageLabelMap[stage] || stage}
                        </div>
                        {current && (
                          <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>
                            {isEn ? "Current status" : "Estado actual"}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quote details */}
            {displayedQ && (
              <div>
                <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, letterSpacing: ".08em", marginBottom: 12 }}>
                  {isEn ? "YOUR QUOTE DETAILS" : "DETALLES DE TU COTIZACIÓN"}
                </div>
                <div style={{ background: "#0c1524", border: "1px solid #1e2d47", borderRadius: 8, overflow: "hidden" }}>
                  <div style={{
                    display: "grid", gridTemplateColumns: "1fr auto auto",
                    padding: "8px 14px", background: "#0a1020",
                    fontSize: 10, color: "#475569", fontWeight: 600, letterSpacing: ".06em",
                  }}>
                    <span>{isEn ? "PART / SERVICE" : "PIEZA / SERVICIO"}</span>
                    <span style={{ textAlign: "right", minWidth: 70 }}>{isEn ? "STORE" : "TIENDA"}</span>
                    <span style={{ textAlign: "right", minWidth: 70 }}>{isEn ? "PRICE" : "PRECIO"}</span>
                  </div>
                  {(displayedQ.lineItems || []).map((item) => (
                    <div key={item.partKey} style={{
                      display: "grid", gridTemplateColumns: "1fr auto auto",
                      padding: "10px 14px", borderTop: "1px solid #0e1a2e",
                      fontSize: 12,
                    }}>
                      <div>
                        <div style={{ color: "#cbd5e1" }}>{lang === "en" ? item.nameEn : item.nameEs}</div>
                        <div style={{ fontSize: 10, color: "#475569", marginTop: 1 }}>{item.availability}</div>
                      </div>
                      <div style={{ textAlign: "right", color: "#64748b", fontSize: 11, whiteSpace: "nowrap", paddingLeft: 10 }}>
                        {item.storeName?.split(" ")[0]}
                      </div>
                      <div style={{ textAlign: "right", color: "#94a3b8", fontWeight: 600, whiteSpace: "nowrap", paddingLeft: 10 }}>
                        {fmt(item.totalPrice)}
                      </div>
                    </div>
                  ))}
                  <div style={{ padding: "12px 14px", borderTop: "2px solid #1e2d47", display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>
                      {isEn ? "Estimated Total" : "Total estimado"}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#f97316" }}>
                      {fmt(displayedQ.totalLow)}–{fmt(displayedQ.totalHigh)}
                    </span>
                  </div>
                </div>
                <p style={{ fontSize: 11, color: "#475569", marginTop: 8 }}>
                  {isEn
                    ? "* Final price may vary based on inspection findings. Tax and labor are estimates."
                    : "* El precio final puede variar según los hallazgos de la inspección. El impuesto y la mano de obra son estimados."}
                </p>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}

/* ── Phone OTP Modal ── */

function PhoneOtpModal({ diagnosisInput, onFreeResult, onClose }) {
  const { lang } = useLang();
  const isEn = lang === "en";
  const [step, setStep] = useState("phone"); // phone | code | loading | paying
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSend = async () => {
    if (!phone.trim()) return;
    setBusy(true); setError("");
    try {
      await sendOtp(phone.trim());
      setStep("code");
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const handleVerify = async () => {
    if (!code.trim()) return;
    setBusy(true); setError("");
    try {
      const res = await verifyOtp(phone.trim(), code.trim());
      if (res.freeEligible) {
        setStep("loading");
        const { result } = await runFreeDiagnosis({ ...diagnosisInput, phone: phone.trim() });
        onFreeResult(result);
      } else {
        setStep("paying");
        const { url } = await startCheckout({ ...diagnosisInput, phone: phone.trim() });
        window.location.href = url;
      }
    } catch (e) {
      if (e.message?.includes("requiresPayment") || e.message?.includes("402")) {
        setStep("paying");
        try {
          const { url } = await startCheckout({ ...diagnosisInput, phone: phone.trim() });
          window.location.href = url;
        } catch (e2) { setError(e2.message); setStep("code"); }
      } else {
        setError(e.message);
      }
    } finally { setBusy(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "white", borderRadius: 16, padding: 32, maxWidth: 420, width: "100%", boxShadow: "0 24px 60px rgba(0,0,0,.22)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: "#1f7251", textTransform: "uppercase", marginBottom: 4 }}>
              {isEn ? "Verify your number" : "Verifica tu número"}
            </div>
            <h3 style={{ margin: 0, fontSize: 20 }}>
              {step === "phone" && (isEn ? "Enter your phone" : "Ingresa tu teléfono")}
              {step === "code"  && (isEn ? "Enter the code" : "Ingresa el código")}
              {step === "loading" && (isEn ? "Running diagnosis…" : "Generando diagnóstico…")}
              {step === "paying" && (isEn ? "Redirecting to payment…" : "Redirigiendo al pago…")}
            </h3>
          </div>
          <button onClick={onClose} style={{ border: 0, background: "none", cursor: "pointer", color: "#69736e" }}><X size={20} /></button>
        </div>

        {step === "phone" && (
          <>
            <p style={{ color: "#69736e", fontSize: 13, marginBottom: 20 }}>
              {isEn
                ? "Your first diagnosis is free. We'll send a 6-digit code to confirm your number."
                : "Tu primer diagnóstico es gratis. Te enviaremos un código de 6 dígitos para confirmar tu número."}
            </p>
            {error && <div className="form-error">{error}</div>}
            <label>{isEn ? "Phone number" : "Número de teléfono"}</label>
            <input
              className="plain-input"
              style={{ width: "100%", marginBottom: 16, padding: "11px 13px", borderRadius: 8, border: "1px solid #dfe5e1" }}
              type="tel"
              placeholder="(916) 555-0100"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSend()}
            />
            <button className="primary full" onClick={handleSend} disabled={busy || !phone.trim()}>
              {busy ? (isEn ? "Sending…" : "Enviando…") : (isEn ? "Send code" : "Enviar código")}
            </button>
          </>
        )}

        {step === "code" && (
          <>
            <p style={{ color: "#69736e", fontSize: 13, marginBottom: 20 }}>
              {isEn ? `Code sent to ${phone}. Enter it below.` : `Código enviado a ${phone}. Ingrésalo abajo.`}
            </p>
            {error && <div className="form-error">{error}</div>}
            <label>{isEn ? "6-digit code" : "Código de 6 dígitos"}</label>
            <input
              className="plain-input"
              style={{ width: "100%", marginBottom: 8, padding: "11px 13px", borderRadius: 8, border: "1px solid #dfe5e1", letterSpacing: 6, fontSize: 22, textAlign: "center" }}
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="------"
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ""))}
              onKeyDown={e => e.key === "Enter" && handleVerify()}
            />
            <button style={{ background: "none", border: 0, color: "#1f7251", fontSize: 12, fontWeight: 700, padding: "4px 0 16px", cursor: "pointer" }} onClick={() => { setStep("phone"); setCode(""); setError(""); }}>
              {isEn ? "← Change number" : "← Cambiar número"}
            </button>
            <button className="primary full" onClick={handleVerify} disabled={busy || code.length < 6}>
              {busy ? (isEn ? "Verifying…" : "Verificando…") : (isEn ? "Verify & continue" : "Verificar y continuar")}
            </button>
          </>
        )}

        {(step === "loading" || step === "paying") && (
          <div style={{ textAlign: "center", padding: "24px 0", color: "#69736e" }}>
            <div style={{ width: 36, height: 36, border: "3px solid #dfe5e1", borderTopColor: "#1f7251", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 16px" }} />
            <p style={{ margin: 0, fontSize: 14 }}>
              {step === "loading"
                ? (isEn ? "Running your AI diagnosis…" : "Generando tu diagnóstico con IA…")
                : (isEn ? "Redirecting to secure payment…" : "Redirigiendo al pago seguro…")}
            </p>
          </div>
        )}

        <p style={{ fontSize: 11, color: "#a0a7a3", textAlign: "center", marginTop: 16, marginBottom: 0 }}>
          {isEn ? "🔒 Secured by Twilio & Stripe" : "🔒 Protegido por Twilio y Stripe"}
        </p>
      </div>
    </div>
  );
}

/* ── Diagnose Result Page (post-Stripe return) ── */

function DiagnoseResultPage({ pendingId }) {
  const { lang } = useLang();
  const isEn = lang === "en";
  const [state, setState] = useState({ ready: false, result: null, vehicle: null, error: "" });

  useEffect(() => {
    let attempts = 0;
    const poll = async () => {
      try {
        const data = await getDiagnoseResult(pendingId);
        if (data.ready) { setState({ ready: true, result: data.result, vehicle: data.vehicle, error: "" }); return; }
        if (attempts++ < 20) setTimeout(poll, 3000);
        else setState(s => ({ ...s, error: isEn ? "Taking longer than expected. Please refresh." : "Está tardando más de lo esperado. Recarga la página." }));
      } catch (e) {
        setState(s => ({ ...s, error: e.message }));
      }
    };
    poll();
  }, [pendingId]);

  const confMap = confidenceDisplay[lang] || confidenceDisplay.es;

  return (
    <main>
      <section className="results-section" style={{ maxWidth: 860, margin: "0 auto", paddingTop: 48 }}>
        {!state.ready && !state.error && (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div style={{ width: 44, height: 44, border: "4px solid #dfe5e1", borderTopColor: "#1f7251", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 20px" }} />
            <h2 style={{ fontSize: 22, marginBottom: 8 }}>{isEn ? "Generating your diagnosis…" : "Generando tu diagnóstico…"}</h2>
            <p style={{ color: "#69736e" }}>{isEn ? "This usually takes 10–20 seconds." : "Esto suele tardar entre 10 y 20 segundos."}</p>
          </div>
        )}
        {state.error && (
          <div className="form-error" style={{ maxWidth: 500, margin: "60px auto" }}>{state.error}</div>
        )}
        {state.ready && state.result && (
          <>
            <div className="section-heading">
              <div className="eyebrow dark"><Check size={14} />{isEn ? "Payment confirmed — here's your diagnosis" : "Pago confirmado — aquí está tu diagnóstico"}</div>
              <h2>{isEn ? "AI Diagnosis" : "Diagnóstico con IA"}</h2>
              {state.vehicle && <p style={{ color: "#69736e" }}>{state.vehicle.year} {state.vehicle.make} {state.vehicle.model}</p>}
            </div>
            <div className="diagnosis-layout">
              <div className="diagnosis-list">
                {(state.result.possibleCauses || []).map((cause, i) => (
                  <div key={i} className={`diagnosis-card${i === 0 ? " featured" : ""}`}>
                    <div className={`probability${cause.tone === "danger" ? " danger" : cause.tone === "warn" ? " warn" : ""}`}>
                      <strong>{Math.round((cause.probability || 0.5) * 100)}%</strong>
                      <span>{isEn ? "likely" : "prob."}</span>
                    </div>
                    <div className="diagnosis-copy">
                      <div className="title-line">
                        <h3>{cause.title}</h3>
                        <span className={`status${cause.tone === "danger" ? " danger" : cause.tone === "warn" ? " warn" : ""}`}>{cause.urgency === "high" ? (isEn ? "Urgent" : "Urgente") : cause.urgency === "medium" ? (isEn ? "Soon" : "Pronto") : (isEn ? "Monitor" : "Monitorear")}</span>
                      </div>
                      <p>{cause.reason}</p>
                      {cause.test && <small><Search size={11} />{cause.test}</small>}
                    </div>
                  </div>
                ))}
              </div>
              {state.result.estimate && (
                <div className="estimate-card">
                  <div className="eyebrow">{isEn ? "Estimated Repair Cost" : "Costo estimado de reparación"}</div>
                  <div className="big-price">${state.result.estimate.low}–${state.result.estimate.high}</div>
                  <div className="confidence">
                    <span>{isEn ? "Confidence" : "Confianza"}</span>
                    <strong>{confMap[state.result.estimate.confidence] || state.result.estimate.confidence}</strong>
                    <div><i /></div>
                  </div>
                  <button className="primary full" style={{ marginTop: 8 }} onClick={() => { window.location.href = "/"; }}>
                    {isEn ? "Get shop quotes →" : "Obtener cotizaciones →"}
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </main>
  );
}

/* ── Customer portal ── */

function CustomerPortal({ user, onRequireAuth }) {
  const { lang } = useLang();
  const t = useT();
  const isEn = lang === "en";

  const demoCauses = isEn ? diagnosisResultsEn : diagnosisResults;
  const demoParts = isEn ? partsResultsEn : partsResults;
  const demoShopList = isEn ? shopsEn : demoShops;

  const defaultDesc = isEn
    ? "I hear a squealing noise from the front when I brake, especially at low speed."
    : "Escucho un rechinido en la parte delantera cuando freno, especialmente a baja velocidad.";

  const [step, setStep] = useState(0);
  const [description, setDescription] = useState(defaultDesc);
  const [zip, setZip] = useState("95814");
  const [radius, setRadius] = useState(t("r25"));
  const [requestedShops, setRequestedShops] = useState([]);
  const [vehicleEntryMode, setVehicleEntryMode] = useState("vin");
  const [vin, setVin] = useState("");
  const [vehicle, setVehicle] = useState({ year: "2019", make: "Honda", model: "Accord", trim: "Sport", engine: "1.5L Turbo" });
  const [mileage, setMileage] = useState("62,410");
  const [diagnosis, setDiagnosis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [vinLoading, setVinLoading] = useState(false);
  const [error, setError] = useState("");
  const [availableShops, setAvailableShops] = useState(demoShopList);
  const [shopsLoading, setShopsLoading] = useState(false);
  const [shopSource, setShopSource] = useState("demo");
  const [vehicleSaved, setVehicleSaved] = useState(false);
  const [quoteConsent, setQuoteConsent] = useState(false);
  const [partDetail, setPartDetail] = useState(null);
  const [partsQuote, setPartsQuote] = useState(null);
  const [partsQuoteLoading, setPartsQuoteLoading] = useState(false);
  const [partsQuoteError, setPartsQuoteError] = useState("");
  const [selectedQuoteOption, setSelectedQuoteOption] = useState("combo");
  const [sendQuoteOpen, setSendQuoteOpen] = useState(false);
  const [otpOpen, setOtpOpen] = useState(false);

  const estimatedTotal = useMemo(() => {
    if (diagnosis?.estimate) return { low: diagnosis.estimate.low, high: diagnosis.estimate.high };
    const lowest = Math.min(...demoParts.map((p) => p.price));
    return { low: Math.round(lowest + 190), high: Math.round(lowest + 365) };
  }, [diagnosis, demoParts]);

  const displayedCauses = diagnosis?.possibleCauses || demoCauses;

  const lookupVin = async () => {
    setError(""); setVinLoading(true);
    try { setVehicle(await decodeVin(vin)); }
    catch (e) { setError(e.message); }
    finally { setVinLoading(false); }
  };

  const updateVehicleField = (field, value) => {
    setVehicle((current) => ({ ...current, [field]: value }));
    setVehicleSaved(false);
  };

  const runAssessment = () => {
    if (!description.trim()) return;
    setError("");
    setOtpOpen(true);
  };

  const onFreeResult = (result) => {
    setOtpOpen(false);
    setDiagnosis(result);
    setStep(1);
  };

  const requestQuote = async (shopName) => {
    if (!quoteConsent) { setError(t("consentRequired")); return; }
    setError("");
    try {
      await saveQuoteRequest({
        shopName, customer: user?.name || "Cliente de RepairScout",
        vehicle: `${vehicle.year} ${vehicle.make} ${vehicle.model}`.trim(),
        issue: description, zip, estimate: `$${estimatedTotal.low}–$${estimatedTotal.high}`,
        diagnosisSummary: diagnosis?.summary,
      });
      setRequestedShops((c) => c.includes(shopName) ? c : [...c, shopName]);
    } catch (e) { setError(e.message); }
  };

  const findShops = async () => {
    setStep(3); setShopsLoading(true); setError("");
    try {
      const n = Number.parseInt(radius, 10) || 25;
      const result = await searchShops(zip, n);
      setAvailableShops(result.shops);
      setShopSource(result.source);
    } catch (e) {
      setError(e.message);
      setAvailableShops(demoShopList);
      setShopSource("fallback");
    } finally { setShopsLoading(false); }
  };

  const persistVehicle = async () => {
    if (!user) { onRequireAuth(); return; }
    setError("");
    try { await saveVehicle({ ...vehicle, vin, mileage }); setVehicleSaved(true); }
    catch (e) { setError(e.message); }
  };

  const loadPartsQuote = async () => {
    if (!diagnosis) return;
    setPartsQuoteLoading(true); setPartsQuoteError("");
    try {
      const result = await buildPartsQuote({ diagnosis, vehicle, language: lang });
      setPartsQuote(result);
    } catch (e) { setPartsQuoteError(e.message); }
    finally { setPartsQuoteLoading(false); }
  };

  const steps = [t("step1"), t("step2"), t("step3"), t("step4")];
  const symptoms = [t("symptom1"), t("symptom2"), t("symptom3")];
  const confMap = confidenceDisplay[lang] || confidenceDisplay.es;

  return (
    <main>
      {otpOpen && (
        <PhoneOtpModal
          diagnosisInput={{ vehicle, mileage, description, zip, language: lang }}
          onFreeResult={onFreeResult}
          onClose={() => setOtpOpen(false)}
        />
      )}
      <section className="customer-hero">
        <div className="hero-copy">
          <div className="eyebrow"><Sparkles size={15} /> {t("heroEyebrow")}</div>
          <h1>{t("heroH1a")}<br /><em>{t("heroH1b")}</em></h1>
          <p>{t("heroDesc")}</p>
          <div className="trust-row">
            <span><ShieldCheck size={18} /> {t("trustNoSurprise")}</span>
            <span><BadgeCheck size={18} /> {t("trustVerified")}</span>
            <span><PackageSearch size={18} /> {t("trustParts")}</span>
          </div>
        </div>

        <div className="intake-card">
          <div className="intake-head">
            <div><span className="step-label">{t("step1of4")}</span><h2>{t("intakeTitle")}</h2></div>
            <span className="ai-orb"><Bot size={23} /></span>
          </div>
          <div className="vehicle-entry-toggle" role="tablist" aria-label={t("manualVehicleLabel")}>
            <button
              type="button"
              className={vehicleEntryMode === "vin" ? "active" : ""}
              onClick={() => setVehicleEntryMode("vin")}
              aria-selected={vehicleEntryMode === "vin"}
            >
              {t("vehicleEntryVin")}
            </button>
            <button
              type="button"
              className={vehicleEntryMode === "manual" ? "active" : ""}
              onClick={() => setVehicleEntryMode("manual")}
              aria-selected={vehicleEntryMode === "manual"}
            >
              {t("vehicleEntryManual")}
            </button>
          </div>
          {vehicleEntryMode === "vin" ? (
            <>
              <label htmlFor="vin">{t("vinLabel")}</label>
              <div className="vin-row">
                <input id="vin" maxLength="17" value={vin} onChange={(e) => { setVin(e.target.value.toUpperCase()); setVehicleSaved(false); }} placeholder={t("vinPlaceholder")} />
                <button className="outline" onClick={lookupVin} disabled={vinLoading || vin.length !== 17}>
                  {vinLoading ? t("vinLoading") : t("vinBtn")}
                </button>
              </div>
            </>
          ) : (
            <>
              <label>{t("manualVehicleLabel")}</label>
              <div className="manual-vehicle-grid">
                {[
                  ["year", t("vehicleYear"), "2019"],
                  ["make", t("vehicleMake"), "Honda"],
                  ["model", t("vehicleModel"), "Accord"],
                  ["trim", `${t("vehicleTrim")} (${t("optionalLabel")})`, "Sport"],
                  ["engine", `${t("vehicleEngine")} (${t("optionalLabel")})`, "1.5L Turbo"],
                ].map(([field, label, placeholder]) => (
                  <label key={field} className={field === "engine" ? "wide" : ""}>
                    {label}
                    <input
                      value={vehicle[field] || ""}
                      onChange={(e) => updateVehicleField(field, e.target.value)}
                      placeholder={placeholder}
                    />
                  </label>
                ))}
              </div>
            </>
          )}
          <div className="vehicle-field">
            <span className="vehicle-icon"><Car size={21} /></span>
            <span>
              <strong>{vehicle.make} {vehicle.model} {vehicle.year}</strong>
              <small>{[vehicle.trim, vehicle.engine].filter(Boolean).join(" · ")} · {mileage} {t("milesUnit")}</small>
            </span>
            <BadgeCheck size={18} />
          </div>
          <button className="save-vehicle" onClick={persistVehicle}>
            {vehicleSaved ? <><Check size={14} /> {t("vehicleSaved")}</> : t("saveVehicle")}
          </button>
          <label htmlFor="mileage">{t("mileageLabel")}</label>
          <input className="plain-input" id="mileage" value={mileage} onChange={(e) => setMileage(e.target.value)} />
          <label htmlFor="description">{t("descLabel")}</label>
          <textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <div className="quick-symptoms">
            {symptoms.map((s) => (
              <button key={s} onClick={() => setDescription(`${description} ${s}.`.trim())}>{s}</button>
            ))}
          </div>
          <div className="location-grid">
            <div>
              <label htmlFor="zip">{t("zipLabel")}</label>
              <div className="input-icon"><MapPin size={17} /><input id="zip" value={zip} onChange={(e) => setZip(e.target.value)} /></div>
            </div>
            <div>
              <label htmlFor="radius">{t("radiusLabel")}</label>
              <select id="radius" value={radius} onChange={(e) => setRadius(e.target.value)}>
                <option>{t("r10")}</option><option>{t("r25")}</option><option>{t("r50")}</option><option>{t("r100")}</option>
              </select>
            </div>
          </div>
          {error && <p className="form-error">{error}</p>}
          <button className="primary full" onClick={runAssessment} disabled={loading}>
            {loading ? t("analyzing") : t("analyzeBtn")} <ArrowRight size={18} />
          </button>
          <p className="medical-note">{t("disclaimer")}</p>
        </div>
      </section>

      <div className="progress-strip">
        {steps.map((label, i) => (
          <button className={i <= step ? "done" : ""} key={label} onClick={() => i <= step && setStep(i)}>
            <span>{i < step ? <Check size={14} /> : i + 1}</span>{label}
          </button>
        ))}
      </div>

      {step === 0 && (
        <section className="landing-story">
          <div className="landing-story-head">
            <span className="eyebrow dark"><Sparkles size={15} /> {t("platformEyebrow")}</span>
            <h2>{t("platformTitle")}</h2>
            <p>{t("platformDesc")}</p>
          </div>
          <div className="landing-feature-grid">
            <article><span>01</span><Bot size={24} /><h3>{t("feat1Title")}</h3><p>{t("feat1Desc")}</p></article>
            <article><span>02</span><PackageSearch size={24} /><h3>{t("feat2Title")}</h3><p>{t("feat2Desc")}</p></article>
            <article><span>03</span><Building2 size={24} /><h3>{t("feat3Title")}</h3><p>{t("feat3Desc")}</p></article>
          </div>
          <div className="audience-grid">
            <article>
              <small>{t("forDriversLabel")}</small>
              <h3>{t("forDriversTitle")}</h3>
              <p>{t("forDriversDesc")}</p>
              <button className="primary" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>{t("forDriversBtn")} <ArrowRight size={17} /></button>
            </article>
            <article>
              <small>{t("forShopsLabel")}</small>
              <h3>{t("forShopsTitle")}</h3>
              <p>{t("forShopsDesc")}</p>
              <button className="outline" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>{t("forShopsBtn")} <Wrench size={17} /></button>
            </article>
          </div>
        </section>
      )}

      {step >= 1 && (
        <section className="results-section">
          <div className="section-heading split">
            <div>
              <span className="eyebrow dark"><Gauge size={15} /> {t("resultsEyebrow")}</span>
              <h2>{t("resultsTitle")}</h2>
              <p>{t("resultsDesc")}</p>
            </div>
            <div className="safety-alert">
              <ShieldCheck size={21} />
              <span><strong>{t("safetyTitle")}</strong>{diagnosis?.safetyMessage || t("defaultSafety")}</span>
            </div>
          </div>
          <div className="diagnosis-layout">
            <div className="diagnosis-list">
              {displayedCauses.map((r, i) => (
                <article className={`diagnosis-card ${i === 0 ? "featured" : ""}`} key={r.title}>
                  <div className={`probability ${r.tone}`}><strong>{r.probability}%</strong><span>{t("probabilityLabel")}</span></div>
                  <div className="diagnosis-copy">
                    <div className="title-line"><h3>{r.title}</h3><span className={`status ${r.tone}`}>{r.urgency}</span></div>
                    <p>{r.reason}</p>
                    <small><Search size={14} /> {t("scoutVerify")} {r.test}</small>
                  </div>
                </article>
              ))}
            </div>
            <aside className="estimate-card">
              <span className="eyebrow dark"><CircleDollarSign size={15} /> {t("estimateEyebrow")}</span>
              <div className="big-price">${estimatedTotal.low}–${estimatedTotal.high}</div>
              <p>{diagnosis?.estimate?.repairLabel || (isEn ? "Front brake pad replacement, confirming rotor condition during inspection." : "Reemplazo de pastillas de freno delanteras, confirmando el estado de los rotores durante la inspección.")}</p>
              <div className="cost-row"><span>{t("partsLabel")}</span><strong>${diagnosis?.estimate?.partsLow ?? 40}–${diagnosis?.estimate?.partsHigh ?? 146}</strong></div>
              <div className="cost-row"><span>{t("laborLabel")} · {diagnosis?.estimate?.laborHoursLow ?? 1.2}–{diagnosis?.estimate?.laborHoursHigh ?? 1.8} h</span><strong>${diagnosis?.estimate?.laborLow ?? 174}–${diagnosis?.estimate?.laborHigh ?? 261}</strong></div>
              <div className="cost-row"><span>{t("taxLabel")}</span><strong>$25–$58</strong></div>
              <div className="confidence"><span>{t("confidenceLabel")}</span><strong>{confMap[diagnosis?.estimate?.confidence] || confMap["Alta"]}</strong><div><i /></div></div>
              <small className="source-note">
                {diagnosis?.source === "fallback"
                  ? t("sourceFallback")
                  : `${t("sourceAI")} ${({ groq: "Groq", gemini: "Google Gemini", openrouter: "OpenRouter", "ai-gateway": "Vercel AI Gateway", openai: "OpenAI" })[diagnosis?.source] || "AI"}`}
              </small>
              <button className="primary full" onClick={() => setStep(2)}>{t("compareBtn")} <ArrowRight size={17} /></button>
              <button
                className="outline full"
                onClick={loadPartsQuote}
                disabled={partsQuoteLoading}
                style={{ marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}
              >
                {partsQuoteLoading
                  ? (isEn ? "Building quote…" : "Generando cotización…")
                  : <><PackageSearch size={15} /> {isEn ? "Build Itemized Quote" : "Generar cotización detallada"}</>}
              </button>
              {partsQuoteError && <p className="form-error" style={{ marginTop: 6, fontSize: 11 }}>{partsQuoteError}</p>}
            </aside>
          </div>

          {/* ── Parts quote options ── */}
          {partsQuote && (
            <div style={{ marginTop: 28 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 11, color: "#f97316", fontWeight: 600, letterSpacing: ".08em" }}>
                    {isEn ? "ITEMIZED PARTS QUOTE" : "COTIZACIÓN DETALLADA DE PIEZAS"}
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                    {isEn ? "Two options based on local store availability" : "Dos opciones según disponibilidad en tiendas locales"}
                  </div>
                </div>
                {partsQuote.quotes.savings > 0 && (
                  <div style={{
                    background: "rgba(74,222,128,.08)", border: "1px solid rgba(74,222,128,.2)",
                    borderRadius: 20, padding: "5px 14px", fontSize: 11, color: "#4ade80", fontWeight: 600,
                  }}>
                    {isEn ? `Save up to ${fmt(partsQuote.quotes.savings)} with combo` : `Ahorra hasta ${fmt(partsQuote.quotes.savings)} con combo`}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                <QuoteCard
                  option={partsQuote.quotes.combo}
                  selected={selectedQuoteOption === "combo"}
                  onSelect={() => setSelectedQuoteOption("combo")}
                  lang={lang}
                />
                <QuoteCard
                  option={partsQuote.quotes.single}
                  selected={selectedQuoteOption === "single"}
                  onSelect={() => setSelectedQuoteOption("single")}
                  lang={lang}
                />
              </div>
              <button
                className="primary"
                style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 8 }}
                onClick={() => setSendQuoteOpen(true)}
              >
                <Send size={15} />
                {isEn ? "Send Quote to Shop / Customer" : "Enviar cotización a taller / cliente"}
              </button>
            </div>
          )}
        </section>
      )}

      {step >= 2 && (
        <section className="results-section soft">
          <div className="section-heading split">
            <div>
              <span className="eyebrow dark"><PackageSearch size={15} /> {t("partsEyebrow")}</span>
              <h2>{t("partsTitle")} {zip}</h2>
              <p>{t("partsDesc")} {radius}.</p>
            </div>
            <button className="outline" onClick={findShops}>{t("findShopsBtn")} <MapPin size={17} /></button>
          </div>
          <div className="parts-table">
            <div className="table-head"><span>{t("colSeller")}</span><span>{t("colAvail")}</span><span>{t("colWarranty")}</span><span>{t("colPrice")}</span></div>
            {demoParts.map((p) => (
              <div className="part-row" key={p.seller}>
                <div className="seller-cell">
                  <span className="seller-icon"><Store size={20} /></span>
                  <span><strong>{p.seller}</strong><small>{p.part}</small><i>{p.badge}</i></span>
                </div>
                <div><strong>{p.availability}</strong><small>{p.distance}</small></div>
                <div><strong>{p.warranty}</strong><small>{t("warrantyTerms")}</small></div>
                <div className="part-price">
                  ${p.price.toFixed(2)}
                  <button onClick={() => setPartDetail(p)}>{t("viewBtn")}</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {step >= 3 && (
        <section className="results-section">
          <div className="section-heading">
            <span className="eyebrow dark"><Building2 size={15} /> {t("shopsEyebrow")}</span>
            <h2>{t("shopsTitle")}</h2>
            <p>{shopsLoading ? t("shopsLoading") : t("shopsNote")(shopSource)}</p>
          </div>
          <label className="consent-box">
            <input type="checkbox" checked={quoteConsent} onChange={(e) => setQuoteConsent(e.target.checked)} />
            <span>{t("consentText")}</span>
          </label>
          <div className="shop-grid">
            {availableShops.map((shop) => {
              const requested = requestedShops.includes(shop.name);
              return (
                <article className="shop-card" key={shop.name}>
                  <div className="shop-card-top">
                    <span className="shop-logo">{shop.name.slice(0, 1)}</span>
                    <div>
                      <h3>{shop.name} {shop.verified && <BadgeCheck size={17} />}</h3>
                      <p>{shop.rating && <><Star size={14} fill="currentColor" /> {shop.rating} ({shop.reviews}) · </>}{shop.distance}</p>
                    </div>
                  </div>
                  <p className="specialty">{shop.specialty}</p>
                  <div className="shop-detail"><Clock3 size={16} /><span>{t("nextAppointment")}<strong>{shop.availability}</strong></span></div>
                  <div className="shop-detail"><CircleDollarSign size={16} /><span>{t("prelimRange")}<strong>{shop.estimate}</strong></span></div>
                  <button
                    className={requested ? "requested full" : "primary full"}
                    disabled={!requested && !quoteConsent}
                    onClick={() => requestQuote(shop.name)}
                  >
                    {requested ? <><Check size={17} /> {t("quoteRequestedBtn")}</> : <>{t("requestQuoteBtn")} <ChevronRight size={17} /></>}
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {partDetail && (
        <div className="modal-backdrop centered" onClick={() => setPartDetail(null)}>
          <section className="auth-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <button className="drawer-close" onClick={() => setPartDetail(null)}><X /></button>
            <span className="eyebrow dark"><Store size={15} /> {partDetail.seller}</span>
            <h2 style={{ fontSize: 16, marginBottom: 8 }}>{partDetail.part}</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              {[[t("colPrice"), `$${partDetail.price.toFixed(2)}`], [t("colAvail"), partDetail.availability], ["Location", partDetail.distance], [t("colWarranty"), partDetail.warranty]].map(([l, v]) => (
                <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: "#64748b" }}>{l}</span>
                  <strong style={{ color: "#f1f5f9" }}>{v}</strong>
                </div>
              ))}
            </div>
            <button className="primary full" onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(partDetail.part + " " + partDetail.seller)}`, "_blank")}>
              {t("searchOnlineBtn")} <ArrowRight size={16} />
            </button>
          </section>
        </div>
      )}

      {sendQuoteOpen && partsQuote && (
        <SendQuoteModal
          quoteData={partsQuote}
          selectedOption={selectedQuoteOption}
          vehicle={vehicle}
          lang={lang}
          onClose={() => setSendQuoteOpen(false)}
          onSent={() => {}}
        />
      )}
    </main>
  );
}

/* ── Shop portal ── */

function SentQuotesPanel({ user }) {
  const { lang } = useLang();
  const isEn = lang === "en";
  const stageLabelMap = STAGE_LABELS[isEn ? "en" : "es"];
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [updating, setUpdating] = useState("");

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    getSentQuotes()
      .then(({ quotes: q }) => setQuotes(q || []))
      .catch(() => setQuotes([]))
      .finally(() => setLoading(false));
  }, [user]);

  const advanceStage = async (quoteId, stage) => {
    setUpdating(`${quoteId}:${stage}`);
    try {
      const { quote: updated } = await updateRepairStage(quoteId, stage);
      setQuotes((qs) => qs.map((q) => q.id === quoteId ? updated : q));
      setExpanded((prev) => prev?.id === quoteId ? updated : prev);
    } catch (e) { console.error(e); }
    finally { setUpdating(""); }
  };

  const statusColor = (stage) => {
    const idx = REPAIR_STAGES.indexOf(stage);
    if (idx >= REPAIR_STAGES.length - 1) return "#4ade80";
    if (idx >= 3) return "#38bdf8";
    return "#f97316";
  };

  return (
    <section className="panel">
      <div className="panel-title">
        <div>
          <h2>{isEn ? "Sent Quotes" : "Cotizaciones enviadas"}</h2>
          <p>{isEn ? "Track customer approvals and update repair stages" : "Seguimiento de aprobaciones y estado de reparación"}</p>
        </div>
      </div>
      {loading && <p style={{ color: "#475569", fontSize: 12, padding: "32px 0", textAlign: "center" }}>{isEn ? "Loading…" : "Cargando…"}</p>}
      {!loading && quotes.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 0", color: "#334155" }}>
          <Send size={32} style={{ opacity: .3, marginBottom: 12 }} />
          <div style={{ fontSize: 13 }}>{isEn ? "No quotes sent yet" : "Aún no has enviado cotizaciones"}</div>
          <div style={{ fontSize: 11, marginTop: 4, color: "#1e2d47" }}>
            {isEn ? 'Use "Build & Send Quote" from a request drawer.' : 'Usa "Generar y enviar cotización" desde el cajón de solicitudes.'}
          </div>
        </div>
      )}
      {quotes.map((q) => {
        const isOpen = expanded?.id === q.id;
        const veh = q.vehicle || {};
        const displayQ = q.quoteSingle || q.quoteCombo;
        const stageIdx = REPAIR_STAGES.indexOf(q.repairStage);
        return (
          <article key={q.id} style={{
            border: "1px solid #1e2d47", borderRadius: 10, marginBottom: 12,
            background: "#0c1524", overflow: "hidden",
          }}>
            <button
              onClick={() => setExpanded(isOpen ? null : q)}
              style={{
                width: "100%", background: "transparent", border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", textAlign: "left",
              }}
            >
              <span className="request-avatar">{q.customerName?.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: "#f1f5f9" }}>{q.customerName}</div>
                <div style={{ fontSize: 11, color: "#64748b" }}>
                  {[veh.year, veh.make, veh.model].filter(Boolean).join(" ") || "—"}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <span style={{
                  fontSize: 10, padding: "3px 8px", borderRadius: 20,
                  border: `1px solid ${statusColor(q.repairStage)}44`,
                  background: `${statusColor(q.repairStage)}11`,
                  color: statusColor(q.repairStage),
                }}>
                  {stageLabelMap[q.repairStage] || q.repairStage}
                </span>
                {displayQ && (
                  <div style={{ fontSize: 12, color: "#f97316", fontWeight: 700, marginTop: 4 }}>
                    {fmt(displayQ.totalLow)}–{fmt(displayQ.totalHigh)}
                  </div>
                )}
              </div>
              <ChevronDown size={15} color="#334155" style={{ transform: isOpen ? "rotate(180deg)" : "", transition: ".2s", flexShrink: 0 }} />
            </button>

            {isOpen && (
              <div style={{ padding: "0 18px 18px", borderTop: "1px solid #0e1a2e" }}>
                {/* Contact info */}
                <div style={{ display: "flex", gap: 16, margin: "14px 0 16px", fontSize: 11 }}>
                  {q.customerEmail && <span style={{ color: "#64748b" }}><Mail size={12} style={{ verticalAlign: "middle" }} /> {q.customerEmail}</span>}
                  {q.customerPhone && <span style={{ color: "#64748b" }}><Phone size={12} style={{ verticalAlign: "middle" }} /> {q.customerPhone}</span>}
                  {q.customerApproved && (
                    <span style={{ color: "#4ade80", fontWeight: 600 }}><Check size={12} style={{ verticalAlign: "middle" }} /> {isEn ? "Approved" : "Aprobada"}</span>
                  )}
                </div>

                {/* Repair stage management */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600, letterSpacing: ".08em", marginBottom: 10 }}>
                    {isEn ? "UPDATE REPAIR STAGE" : "ACTUALIZAR ETAPA DE REPARACIÓN"}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {REPAIR_STAGES.map((stage, idx) => {
                      const isCurrent = q.repairStage === stage;
                      const isDone = REPAIR_STAGES.indexOf(q.repairStage) > idx;
                      const busy = updating === `${q.id}:${stage}`;
                      return (
                        <button
                          key={stage}
                          onClick={() => advanceStage(q.id, stage)}
                          disabled={isCurrent || busy}
                          style={{
                            fontSize: 10, padding: "5px 10px", borderRadius: 6, cursor: isCurrent ? "default" : "pointer",
                            border: isCurrent ? `1px solid ${statusColor(stage)}` : isDone ? "1px solid #334155" : "1px solid #1e2d47",
                            background: isCurrent ? `${statusColor(stage)}18` : "transparent",
                            color: isCurrent ? statusColor(stage) : isDone ? "#475569" : "#64748b",
                            fontFamily: "inherit",
                          }}
                        >
                          {busy ? "…" : (isDone ? <><Check size={10} style={{ verticalAlign: "middle" }} /> </> : "")}{stageLabelMap[stage] || stage}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Parts list preview */}
                {displayQ?.lineItems?.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600, letterSpacing: ".08em", marginBottom: 8 }}>
                      {isEn ? "QUOTED PARTS" : "PIEZAS COTIZADAS"}
                    </div>
                    <div style={{ background: "#0a1020", border: "1px solid #0e1a2e", borderRadius: 6, overflow: "hidden" }}>
                      {displayQ.lineItems.map((item) => (
                        <div key={item.partKey} style={{
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                          padding: "7px 12px", borderBottom: "1px solid #0e1a2e", fontSize: 11,
                        }}>
                          <span style={{ color: "#94a3b8" }}>{isEn ? item.nameEn : item.nameEs}</span>
                          <span style={{ color: "#f97316", fontWeight: 600 }}>{fmt(item.totalPrice)}</span>
                        </div>
                      ))}
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 12px", fontSize: 12, fontWeight: 700 }}>
                        <span style={{ color: "#f1f5f9" }}>{isEn ? "Total (est.)" : "Total (est.)"}</span>
                        <span style={{ color: "#f97316" }}>{fmt(displayQ.totalLow)}–{fmt(displayQ.totalHigh)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tracking link */}
                <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
                  <button
                    className="outline"
                    style={{ fontSize: 11, flex: 1 }}
                    onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/track/${q.token}`)}
                  >
                    {isEn ? "Copy Track Link" : "Copiar enlace de seguimiento"}
                  </button>
                  <button
                    className="outline"
                    style={{ fontSize: 11, flex: 1 }}
                    onClick={() => window.open(`/track/${q.token}`, "_blank")}
                  >
                    {isEn ? "View as Customer" : "Ver como cliente"}
                  </button>
                </div>
              </div>
            )}
          </article>
        );
      })}
    </section>
  );
}

function Sidebar({ active, setActive, shopProfile, user }) {
  const t = useT();
  const { lang } = useLang();
  const isEn = lang === "en";
  const isAdmin = user?.role === "admin";
  const links = [
    [t("tabResumen"), LayoutDashboard],
    [t("tabSolicitudes"), MessageSquareText],
    [isEn ? "Sent Quotes" : "Cotizaciones", Send],
    [t("tabCitas"), Calendar],
    [t("tabOrdenes"), Wrench],
    [t("tabClientes"), Users],
    [t("tabPiezas"), PackageSearch],
    [t("tabScout"), Bot],
    [t("tabPerfil"), Building2],
    ...(isAdmin ? [["Admin", ShieldCheck]] : []),
  ];

  return (
    <aside className="shop-sidebar">
      <Brand />
      <div className="shop-identity">
        <span>{(shopProfile?.shopName || "RS").slice(0, 2).toUpperCase()}</span>
        <div><strong>{shopProfile?.shopName || t("setupShopName")}</strong><small>{shopProfile?.claimed ? t("claimed") : "Admin"}</small></div>
        <ChevronDown size={16} />
      </div>
      <nav>
        {links.map(([label, Icon]) => (
          <button className={active === label ? "active" : ""} onClick={() => setActive(label)} key={label}>
            <Icon size={18} />{label}{label === t("tabSolicitudes") ? <i>3</i> : null}
          </button>
        ))}
      </nav>
      <div className="sidebar-promo">
        <Bot size={25} />
        <strong>{t("sidebarPromoTitle")}</strong>
        <p>{t("sidebarPromoDesc")}</p>
        <button onClick={() => setActive(t("tabScout"))}>{t("askScoutBtn")}</button>
      </div>
      <small className="sidebar-foot">{t("sidebarFoot")}</small>
    </aside>
  );
}

function ShopProfilePanel({ profileForm, setProfileForm, onSave, profileSaving, profileMessage }) {
  const { lang } = useLang();
  const isEn = lang === "en";
  const specialtyText = Array.isArray(profileForm.specialties) ? profileForm.specialties.join(", ") : "";
  return (
    <section className="panel shop-profile-panel">
      <div className="panel-title">
        <div>
          <h2>{isEn ? "Shop Profile" : "Perfil del taller"}</h2>
          <p>{isEn ? "This info prepares your shop to receive real requests and quote faster." : "Estos datos preparan tu taller para recibir solicitudes reales y cotizar mejor."}</p>
        </div>
        <span className={profileForm.claimed ? "live-badge on" : "live-badge"}>{profileForm.claimed ? (isEn ? "Claimed" : "Reclamado") : (isEn ? "Pending" : "Pendiente")}</span>
      </div>
      <div className="profile-form">
        <label>{isEn ? "Shop name" : "Nombre del taller"}<input value={profileForm.shopName || ""} onChange={(e) => setProfileForm((c) => ({ ...c, shopName: e.target.value }))} /></label>
        <label>{isEn ? "Primary contact" : "Contacto principal"}<input value={profileForm.contactName || ""} onChange={(e) => setProfileForm((c) => ({ ...c, contactName: e.target.value }))} /></label>
        <label>{isEn ? "Phone" : "Teléfono"}<input value={profileForm.phone || ""} onChange={(e) => setProfileForm((c) => ({ ...c, phone: e.target.value }))} /></label>
        <label>{isEn ? "Shop email" : "Correo del taller"}<input type="email" value={profileForm.email || ""} onChange={(e) => setProfileForm((c) => ({ ...c, email: e.target.value }))} /></label>
        <label className="wide">{isEn ? "Address" : "Dirección"}<input value={profileForm.address || ""} onChange={(e) => setProfileForm((c) => ({ ...c, address: e.target.value }))} /></label>
        <label>{isEn ? "City" : "Ciudad"}<input value={profileForm.city || ""} onChange={(e) => setProfileForm((c) => ({ ...c, city: e.target.value }))} /></label>
        <label>{isEn ? "State" : "Estado"}<input value={profileForm.state || ""} onChange={(e) => setProfileForm((c) => ({ ...c, state: e.target.value }))} /></label>
        <label>{isEn ? "ZIP code" : "Código postal"}<input value={profileForm.zip || ""} onChange={(e) => setProfileForm((c) => ({ ...c, zip: e.target.value }))} /></label>
        <label>{isEn ? "Labor rate" : "Tarifa de mano de obra"}<input value={profileForm.laborRate || ""} onChange={(e) => setProfileForm((c) => ({ ...c, laborRate: e.target.value }))} placeholder="$145/h" /></label>
        <label className="wide">{isEn ? "Specialties" : "Especialidades"}<input value={specialtyText} onChange={(e) => setProfileForm((c) => ({ ...c, specialties: e.target.value.split(",").map((i) => i.trim()).filter(Boolean) }))} placeholder={isEn ? "Brakes, suspension, electrical diagnosis" : "Frenos, suspensión, diagnóstico eléctrico"} /></label>
        <label className="wide">{isEn ? "Warranty" : "Garantía"}<input value={profileForm.warranty || ""} onChange={(e) => setProfileForm((c) => ({ ...c, warranty: e.target.value }))} placeholder={isEn ? "12 months / 12,000 miles" : "12 meses / 12,000 millas"} /></label>
        <label className="wide">{isEn ? "Availability" : "Disponibilidad"}<input value={profileForm.availability || ""} onChange={(e) => setProfileForm((c) => ({ ...c, availability: e.target.value }))} placeholder={isEn ? "Mon–Fri 8am–6pm, Sat by appt" : "Lun–Vie 8am–6pm, sábados por cita"} /></label>
      </div>
      {profileMessage && <p className="profile-message">{profileMessage}</p>}
      <button className="primary" onClick={onSave} disabled={profileSaving}>
        {profileSaving ? (isEn ? "Saving..." : "Guardando...") : (isEn ? "Save & claim shop" : "Guardar y reclamar taller")} <Check size={17} />
      </button>
    </section>
  );
}

const ROLE_COLOR = { admin: "#a855f7", shop: "#3b82f6", driver: "#22c55e" };

function AdminPanel() {
  const { lang } = useLang();
  const isEn = lang === "en";
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [plans, setPlans] = useState([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [roleUpdating, setRoleUpdating] = useState("");
  const [planSaving, setPlanSaving] = useState("");
  const [planMessage, setPlanMessage] = useState("");

  useEffect(() => {
    Promise.allSettled([getAdminStats(), getAdminUsers(), getAdminQuotes(), getAdminPlans()])
      .then(([s, u, q, p]) => {
        if (s.status === "fulfilled") setStats(s.value);
        if (u.status === "fulfilled") setUsers(u.value.users || []);
        if (q.status === "fulfilled") setQuotes(q.value.quotes || []);
        if (p.status === "fulfilled") setPlans(p.value.plans || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const changeRole = async (id, role) => {
    setRoleUpdating(id);
    try {
      await setAdminUserRole(id, role);
      setUsers((prev) => prev.map((u) => u.id === id ? { ...u, role } : u));
    } catch (e) { console.error(e); }
    finally { setRoleUpdating(""); }
  };

  const updatePlanField = (id, field, value) => {
    setPlans((prev) => prev.map((plan) => plan.id === id ? { ...plan, [field]: value } : plan));
    setPlanMessage("");
  };

  const savePlan = async (plan) => {
    setPlanSaving(plan.id);
    setPlanMessage("");
    try {
      const payload = {
        ...plan,
        priceMonthly: Number(plan.priceMonthly) || 0,
        requestLimit: Number(plan.requestLimit) || 0,
        diagnosisLimit: Number(plan.diagnosisLimit) || 0,
        quoteLimit: Number(plan.quoteLimit) || 0,
        features: Array.isArray(plan.features)
          ? plan.features
          : String(plan.features || "").split(",").map((item) => item.trim()).filter(Boolean),
      };
      const result = await updateAdminPlan(plan.id, payload);
      setPlans((prev) => prev.map((item) => item.id === plan.id ? result.plan : item));
      setPlanMessage(isEn ? "Plan saved." : "Plan guardado.");
    } catch (e) {
      setPlanMessage(e.message);
    } finally {
      setPlanSaving("");
    }
  };

  const STAT_DARK = { background: "#0d1829", border: "1px solid #1e2d47", borderRadius: 10, padding: "16px 18px" };
  const FIELD_STYLE = { background: "#101b2d", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 6, fontSize: 12, padding: "8px 10px", width: "100%" };

  if (loading) return <section className="panel"><p style={{ color: "#94a3b8", padding: 24 }}>Loading admin data…</p></section>;

  return (
    <section className="panel">
      <div className="panel-title">
        <div>
          <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}><ShieldCheck size={20} color="#a855f7" /> Admin Panel</h2>
          <p>RepairScout platform overview · Humberto Zepeda</p>
        </div>
      </div>

      {/* Tab switcher */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        {[["overview", isEn ? "Overview" : "Resumen"], ["plans", isEn ? "Plans" : "Planes"], ["users", isEn ? "Users" : "Usuarios"], ["quotes", isEn ? "All Quotes" : "Cotizaciones"]].map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)} style={{
            padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer",
            background: activeTab === key ? "#a855f7" : "#1e2d47", color: "#fff",
          }}>{label}</button>
        ))}
      </div>

      {/* ── Overview ── */}
      {activeTab === "overview" && stats && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 20 }}>
            {[
              ["Total Users", stats.totalUsers, "#a855f7"],
              ["Shops", stats.shops, "#3b82f6"],
              ["Drivers", stats.drivers, "#22c55e"],
              ["Total Quotes", stats.totalQuotes, "#f59e0b"],
              ["Diagnoses", stats.totalDiagnoses, "#06b6d4"],
              ["Approved Quotes", stats.approvedQuotes, "#10b981"],
            ].map(([label, val, color]) => (
              <div key={label} style={{ ...STAT_DARK, textAlign: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 800, color }}>{val ?? "—"}</div>
                <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4 }}>{label}</div>
              </div>
            ))}
          </div>
          <div style={{ ...STAT_DARK, fontSize: 12, color: "#94a3b8" }}>
            <strong style={{ color: "#e2e8f0" }}>System</strong>
            <div style={{ marginTop: 8, display: "flex", gap: 16, flexWrap: "wrap" }}>
              <span>DB: <strong style={{ color: "#22c55e" }}>Neon PostgreSQL</strong></span>
              <span>AI: <strong style={{ color: "#22c55e" }}>Active</strong></span>
              <span>Bland.ai: <strong style={{ color: "#22c55e" }}>Configured</strong></span>
              <span>Admin: <strong style={{ color: "#a855f7" }}>humberto.wgw@gmail.com</strong></span>
            </div>
          </div>
        </>
      )}

      {/* ── Plans ── */}
      {activeTab === "plans" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
            <p style={{ fontSize: 11, color: "#64748b", margin: 0 }}>
              {isEn ? "Adjust driver and shop plans, pricing, usage limits, and availability." : "Ajusta planes de conductores y talleres, precios, límites y disponibilidad."}
            </p>
            {planMessage && <span style={{ color: planMessage.includes("saved") || planMessage.includes("guardado") ? "#22c55e" : "#f87171", fontSize: 11, fontWeight: 700 }}>{planMessage}</span>}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
            {plans.map((plan) => (
              <article key={plan.id} style={{ ...STAT_DARK, display: "grid", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                  <div>
                    <span style={{ fontSize: 10, color: plan.audience === "shop" ? "#60a5fa" : "#4ade80", fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em" }}>{plan.audience}</span>
                    <h3 style={{ margin: "3px 0 0", color: "#f1f5f9", fontSize: 16 }}>{plan.name}</h3>
                  </div>
                  <label style={{ display: "flex", alignItems: "center", gap: 7, margin: 0, color: "#94a3b8", fontSize: 11 }}>
                    <input
                      type="checkbox"
                      checked={Boolean(plan.active)}
                      onChange={(e) => updatePlanField(plan.id, "active", e.target.checked)}
                      style={{ width: "auto" }}
                    />
                    {isEn ? "Active" : "Activo"}
                  </label>
                </div>
                <label style={{ margin: 0, color: "#94a3b8", fontSize: 10 }}>
                  {isEn ? "Plan name" : "Nombre del plan"}
                  <input style={{ ...FIELD_STYLE, marginTop: 5 }} value={plan.name || ""} onChange={(e) => updatePlanField(plan.id, "name", e.target.value)} />
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                  <label style={{ margin: 0, color: "#94a3b8", fontSize: 10 }}>
                    {isEn ? "Monthly price" : "Precio mensual"}
                    <input type="number" min="0" style={{ ...FIELD_STYLE, marginTop: 5 }} value={plan.priceMonthly ?? 0} onChange={(e) => updatePlanField(plan.id, "priceMonthly", e.target.value)} />
                  </label>
                  <label style={{ margin: 0, color: "#94a3b8", fontSize: 10 }}>
                    {isEn ? "Audience" : "Audiencia"}
                    <select style={{ ...FIELD_STYLE, marginTop: 5 }} value={plan.audience} onChange={(e) => updatePlanField(plan.id, "audience", e.target.value)}>
                      <option value="driver">{isEn ? "Driver" : "Conductor"}</option>
                      <option value="shop">{isEn ? "Shop" : "Taller"}</option>
                    </select>
                  </label>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
                  {[
                    ["requestLimit", isEn ? "Requests" : "Solicitudes"],
                    ["diagnosisLimit", isEn ? "Diagnoses" : "Diagnósticos"],
                    ["quoteLimit", isEn ? "Quotes" : "Cotizaciones"],
                  ].map(([field, label]) => (
                    <label key={field} style={{ margin: 0, color: "#94a3b8", fontSize: 10 }}>
                      {label}
                      <input type="number" min="0" style={{ ...FIELD_STYLE, marginTop: 5 }} value={plan[field] ?? 0} onChange={(e) => updatePlanField(plan.id, field, e.target.value)} />
                    </label>
                  ))}
                </div>
                <label style={{ margin: 0, color: "#94a3b8", fontSize: 10 }}>
                  {isEn ? "Description" : "Descripción"}
                  <textarea
                    style={{ ...FIELD_STYLE, resize: "vertical", minHeight: 58, marginTop: 5, fontFamily: "inherit" }}
                    value={plan.description || ""}
                    onChange={(e) => updatePlanField(plan.id, "description", e.target.value)}
                  />
                </label>
                <label style={{ margin: 0, color: "#94a3b8", fontSize: 10 }}>
                  {isEn ? "Features, comma separated" : "Beneficios, separados por coma"}
                  <input
                    style={{ ...FIELD_STYLE, marginTop: 5 }}
                    value={Array.isArray(plan.features) ? plan.features.join(", ") : plan.features || ""}
                    onChange={(e) => updatePlanField(plan.id, "features", e.target.value)}
                  />
                </label>
                <button className="primary" onClick={() => savePlan(plan)} disabled={planSaving === plan.id} style={{ marginTop: 2 }}>
                  {planSaving === plan.id ? (isEn ? "Saving..." : "Guardando...") : (isEn ? "Save plan" : "Guardar plan")} <Check size={16} />
                </button>
              </article>
            ))}
          </div>
        </div>
      )}

      {/* ── Users ── */}
      {activeTab === "users" && (
        <div>
          <p style={{ fontSize: 11, color: "#64748b", marginBottom: 12 }}>{users.length} registered users</p>
          {users.map((u) => (
            <div key={u.id} style={{ ...STAT_DARK, display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <span style={{ width: 36, height: 36, borderRadius: "50%", background: ROLE_COLOR[u.role] || "#334155", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "#fff", fontSize: 13, flexShrink: 0 }}>
                {(u.name || u.email).slice(0, 2).toUpperCase()}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: "#e2e8f0", fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.name || "—"}</div>
                <div style={{ fontSize: 11, color: "#64748b" }}>{u.email}</div>
                {u.shopName && <div style={{ fontSize: 10, color: "#94a3b8" }}>{u.shopName}</div>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, background: ROLE_COLOR[u.role] + "22", color: ROLE_COLOR[u.role] }}>
                  {u.role}
                </span>
                <select
                  disabled={roleUpdating === u.id}
                  value={u.role}
                  onChange={(e) => changeRole(u.id, e.target.value)}
                  style={{ background: "#1e2d47", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 4, fontSize: 11, padding: "3px 6px", cursor: "pointer" }}
                >
                  <option value="driver">driver</option>
                  <option value="shop">shop</option>
                  <option value="admin">admin</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── All Quotes ── */}
      {activeTab === "quotes" && (
        <div>
          <p style={{ fontSize: 11, color: "#64748b", marginBottom: 12 }}>{quotes.length} total quote requests</p>
          {quotes.map((q) => (
            <div key={q.id} style={{ ...STAT_DARK, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: "#e2e8f0", fontSize: 13 }}>{q.customer}</div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>{q.vehicle} · {q.issue}</div>
                <div style={{ fontSize: 10, color: "#64748b" }}>{q.shopName} · {new Date(q.createdAt).toLocaleDateString()}</div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontWeight: 800, color: "#f1f5f9" }}>{q.estimate}</div>
                <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: q.status === "Cotizada" ? "#1d4ed822" : "#33415522", color: q.status === "Cotizada" ? "#3b82f6" : "#94a3b8" }}>
                  {q.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// Stable tab keys that survive language switches
const TAB_KEYS = ["tabResumen","tabSolicitudes","sentQuotes","tabCitas","tabOrdenes","tabClientes","tabPiezas","tabScout","tabPerfil","admin"];

function tabLabel(key, lang) {
  if (key === "sentQuotes") return lang === "en" ? "Sent Quotes" : "Cotizaciones";
  if (key === "admin") return "Admin";
  return T[lang]?.[key] ?? T.es[key] ?? key;
}

function tabKeyFromLabel(label, lang) {
  if (label === "Sent Quotes" || label === "Cotizaciones") return "sentQuotes";
  if (label === "Admin") return "admin";
  return TAB_KEYS.find((k) => T[lang]?.[k] === label || T.es[k] === label) ?? "tabResumen";
}

function ShopPortal({ user, onRequireAuth }) {
  const { lang } = useLang();
  const t = useT();
  const isEn = lang === "en";
  const demoQR = isEn ? quoteRequestsEn : quoteRequests;
  const [activeKey, setActiveKey] = useState(user?.role === "admin" ? "admin" : "tabResumen");
  const active = tabLabel(activeKey, lang);
  const setActive = (label) => setActiveKey(tabKeyFromLabel(label, lang));
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [savedRequests, setSavedRequests] = useState([]);
  const [shopProfile, setShopProfile] = useState(null);
  const [profileForm, setProfileForm] = useState({
    shopName: user?.shopName || "", contactName: user?.name || "", email: user?.email || "",
    phone: "", address: "", city: "", state: "", zip: "", specialties: [],
    laborRate: "", warranty: "", availability: "", claimed: false,
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [health, setHealth] = useState(null);
  const [statusUpdating, setStatusUpdating] = useState("");
  const [bookingOpen, setBookingOpen] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const [messageTarget, setMessageTarget] = useState(null);
  const [shopSendQuoteOpen, setShopSendQuoteOpen] = useState(false);
  const [shopQuoteData, setShopQuoteData] = useState(null);
  const [shopQuoteBuilding, setShopQuoteBuilding] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [notifOpen, setNotifOpen] = useState(false);
  const [approvedQuotes, setApprovedQuotes] = useState([]);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([getQuoteRequests(), getShopProfile(), getSystemHealth(), getSentQuotes()])
      .then(([rr, pr, hr, sq]) => {
        if (cancelled) return;
        if (rr.status === "fulfilled") setSavedRequests(rr.value.quoteRequests);
        if (pr.status === "fulfilled") { setShopProfile(pr.value.profile); setProfileForm((c) => ({ ...c, ...pr.value.profile })); }
        if (hr.status === "fulfilled") setHealth(hr.value);
        if (sq.status === "fulfilled") {
          const newlyApproved = (sq.value.quotes || []).filter((q) => q.customerApproved && q.repairStage === "Approved");
          setApprovedQuotes(newlyApproved);
        }
      })
      .catch(() => { if (!cancelled) setSavedRequests([]); });
    return () => { cancelled = true; };
  }, []);

  const saveProfile = async () => {
    if (!user) { onRequireAuth(); return; }
    setProfileSaving(true); setProfileMessage("");
    try {
      const result = await saveShopProfile(profileForm);
      setShopProfile(result.profile);
      setProfileForm((c) => ({ ...c, ...result.profile }));
      setProfileMessage(t("profileSaved"));
    } catch (e) { setProfileMessage(e.message); }
    finally { setProfileSaving(false); }
  };

  const changeRequestStatus = async (request, status) => {
    if (!request.id) return;
    setStatusUpdating(`${request.id}:${status}`);
    try {
      const result = await updateQuoteRequestStatus(request.id, status);
      setSavedRequests((c) => c.map((i) => i.id === request.id ? result.quoteRequest : i));
      setSelectedRequest((c) => c?.id === request.id ? { ...c, ...result.quoteRequest, value: result.quoteRequest.estimate, distance: result.quoteRequest.zip } : c);
    } catch (e) { setProfileMessage(e.message); }
    finally { setStatusUpdating(""); }
  };

  const visibleRequests = useMemo(() => {
    const locale = lang === "en" ? "en-US" : "es-US";
    const live = savedRequests.map((r) => ({
      ...r, value: r.estimate, distance: r.zip,
      time: new Date(r.createdAt).toLocaleString(locale, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
    }));
    return [...live, ...demoQR];
  }, [savedRequests, demoQR, lang]);

  const openMessage = (request) => { setMessageTarget(request); setMessageOpen(true); setSelectedRequest(null); };

  const buildShopQuote = async (req) => {
    setShopQuoteBuilding(true);
    setShopQuoteData(null);
    try {
      const vehicleParts = (req.vehicle || "").split(" ");
      const veh = { year: vehicleParts[0], make: vehicleParts[1], model: vehicleParts.slice(2).join(" ") };
      const mockDiagnosis = {
        summary: req.issue,
        possibleCauses: [{ title: req.issue, reason: "", test: "", probability: 80, urgency: "Verify" }],
        estimate: { laborHoursLow: 1.5, laborHoursHigh: 3 },
      };
      const result = await buildPartsQuote({ diagnosis: mockDiagnosis, vehicle: veh, language: lang });
      setShopQuoteData(result);
      setShopSendQuoteOpen(true);
      setSelectedRequest(null);
    } catch (e) {
      console.error(e);
    } finally {
      setShopQuoteBuilding(false);
    }
  };

  return (
    <main className="shop-shell">
      <Sidebar active={active} setActive={setActive} shopProfile={shopProfile || profileForm} user={user} />
      <div className="shop-main">
        <header className="shop-header">
          <div>
            <span className="breadcrumb">{t("shopPortalBreadcrumb")} / {active}</span>
            <h1>{active === "Resumen" || active === "Overview" ? `${t("goodMorning")}${user?.name ? `, ${user.name.split(" ")[0]}` : ""}` : active}</h1>
          </div>
          <div className="shop-header-actions" style={{ position: "relative" }}>
            {!user && <button className="outline compact" onClick={onRequireAuth}>{t("signInCreate")}</button>}
            <button className="icon-button" onClick={() => { setSearchOpen(true); setNotifOpen(false); }}><Search size={19} /></button>
            <div style={{ position: "relative" }}>
              <button className="icon-button" onClick={() => { setNotifOpen((o) => !o); setSearchOpen(false); }}>
                <Bell size={19} />
                {(approvedQuotes.length > 0 || savedRequests.filter((r) => r.status === "Solicitud nueva").length > 0) && (
                  <i style={{ position: "absolute", top: 4, right: 4, width: 8, height: 8, borderRadius: "50%", background: "#ef4444", border: "2px solid #0d1829", display: "block" }} />
                )}
              </button>
              {notifOpen && (
                <div style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", width: 310, background: "#0d1829", border: "1px solid #1e2d47", borderRadius: 10, boxShadow: "0 8px 32px #0008", zIndex: 200, overflow: "hidden" }}>
                  <div style={{ padding: "12px 14px 8px", borderBottom: "1px solid #1e2d47", fontWeight: 700, fontSize: 12, color: "#e2e8f0", display: "flex", justifyContent: "space-between" }}>
                    {isEn ? "Notifications" : "Notificaciones"}
                    <button onClick={() => setNotifOpen(false)} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>×</button>
                  </div>
                  <div style={{ maxHeight: 360, overflowY: "auto" }}>
                    {/* Approved quotes — action needed */}
                    {approvedQuotes.map((q) => {
                      const veh = q.vehicle || {};
                      const vehicleStr = [veh.year, veh.make, veh.model].filter(Boolean).join(" ");
                      return (
                        <button key={q.id} onClick={() => { setActiveKey("tabOrdenes"); setNotifOpen(false); }}
                          style={{ width: "100%", background: "rgba(74,222,128,.06)", border: "none", borderBottom: "1px solid #4ade8022", padding: "10px 14px", textAlign: "left", cursor: "pointer", display: "flex", gap: 10, alignItems: "center" }}>
                          <span style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(74,222,128,.2)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "#4ade80", fontSize: 11, flexShrink: 0 }}>
                            {(q.customerName || "?").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                          </span>
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ display: "block", fontWeight: 700, color: "#4ade80", fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              <Check size={11} style={{ verticalAlign: "middle", marginRight: 3 }} />
                              {isEn ? "Quote Approved!" : "¡Cotización aprobada!"}
                            </span>
                            <span style={{ display: "block", fontSize: 10, color: "#64748b" }}>{q.customerName} · {vehicleStr}</span>
                          </span>
                          <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 10, background: "#4ade8022", color: "#4ade80", fontWeight: 700, flexShrink: 0 }}>
                            {isEn ? "START WO" : "INICIAR"}
                          </span>
                        </button>
                      );
                    })}
                    {/* Regular requests */}
                    {visibleRequests.slice(0, 6).map((r) => (
                      <button key={r.id || r.customer} onClick={() => { setSelectedRequest(r); setNotifOpen(false); }} style={{ width: "100%", background: "none", border: "none", borderBottom: "1px solid #1e2d4744", padding: "10px 14px", textAlign: "left", cursor: "pointer", display: "flex", gap: 10, alignItems: "center" }}>
                        <span style={{ width: 32, height: 32, borderRadius: "50%", background: "#1e3a5f", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "#93c5fd", fontSize: 11, flexShrink: 0 }}>{r.initials}</span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: "block", fontWeight: 600, color: "#e2e8f0", fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.customer}</span>
                          <span style={{ display: "block", fontSize: 10, color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.vehicle} · {r.issue}</span>
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#f1f5f9", flexShrink: 0 }}>{r.value || r.estimate}</span>
                      </button>
                    ))}
                    {visibleRequests.length === 0 && approvedQuotes.length === 0 && (
                      <p style={{ padding: "16px 14px", fontSize: 12, color: "#64748b" }}>{isEn ? "No new notifications" : "Sin notificaciones"}</p>
                    )}
                  </div>
                  <div style={{ padding: "8px 14px", borderTop: "1px solid #1e2d47", display: "flex", gap: 8 }}>
                    <button onClick={() => { setActiveKey("tabSolicitudes"); setNotifOpen(false); }} style={{ background: "none", border: "none", color: "#3b82f6", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                      {isEn ? "All requests →" : "Solicitudes →"}
                    </button>
                    {approvedQuotes.length > 0 && (
                      <button onClick={() => { setActiveKey("tabOrdenes"); setNotifOpen(false); }} style={{ background: "none", border: "none", color: "#4ade80", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                        {isEn ? "Work orders →" : "Órdenes →"}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
            <span className="avatar">{user?.name ? user.name.split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase() : "RS"}</span>
          </div>
        </header>

        <div className="shop-content">
          <section className="connection-strip">
            <span className={health?.database === "postgres" ? "live-badge on" : "live-badge"}>{t("dbLabel")} {health?.database || t("dbChecking")}</span>
            <span className={health?.authConfigured ? "live-badge on" : "live-badge"}>{t("accountsLabel")} {health?.authConfigured ? t("accountsActive") : t("accountsPending")}</span>
            <span className={health?.aiConfigured ? "live-badge warn" : "live-badge"}>
              {t("aiLabel")} {health?.aiProviders?.configured?.length ? health.aiProviders.configured.join(" + ") : t("aiFallback")}
            </span>
            <span className={shopProfile?.claimed ? "live-badge on" : "live-badge"}>{t("shopStatusLabel")} {shopProfile?.claimed ? t("shopClaimed") : t("shopSetup")}</span>
          </section>

          {/* Profile panel — shown when tab is Perfil OR shop not yet claimed */}
          {(active === t("tabPerfil") || (!shopProfile?.claimed && user?.role !== "admin")) && (
            <ShopProfilePanel profileForm={profileForm} setProfileForm={setProfileForm} onSave={saveProfile} profileSaving={profileSaving} profileMessage={profileMessage} />
          )}

          {/* ── Tab routing ── */}
          {active === t("tabResumen") && (
            <>
              <section className="metric-grid">
                <article style={{ cursor: "pointer" }} onClick={() => setActive(t("tabSolicitudes"))}>
                  <span className="metric-icon green"><MessageSquareText /></span>
                  <div><small>{t("newRequests")}</small><strong>{visibleRequests.length}</strong><em>{savedRequests.length} {t("receivedInApp")}</em></div>
                </article>
                <article style={{ cursor: "pointer" }} onClick={() => setActive(t("tabCitas"))}>
                  <span className="metric-icon blue"><Calendar /></span>
                  <div><small>{t("todayAppts")}</small><strong>7</strong><em>{t("firstAppt")}</em></div>
                </article>
                <article style={{ cursor: "pointer" }} onClick={() => setActive(t("tabOrdenes"))}>
                  <span className="metric-icon amber"><Wrench /></span>
                  <div><small>{t("openOrders")}</small><strong>5</strong><em>{t("inProgress3")}</em></div>
                </article>
                <article>
                  <span className="metric-icon purple"><CircleDollarSign /></span>
                  <div><small>{t("quotedWeek")}</small><strong>$8,940</strong><em className="positive">↑ 12.4%</em></div>
                </article>
              </section>

              <section className="shop-columns">
                <div className="panel requests-panel">
                  <div className="panel-title">
                    <div><h2>{t("quoteRequestsTitle")}</h2><p>{t("quoteRequestsDesc")}</p></div>
                    <button onClick={() => setActive(t("tabSolicitudes"))}>{t("viewAll")}</button>
                  </div>
                  <div className="request-list">
                    {visibleRequests.map((r) => {
                      const sdMap = statusDisplay[lang] || statusDisplay.es;
                      return (
                        <button className="request-row" key={r.id || `${r.customer}-${r.vehicle}`} onClick={() => setSelectedRequest(r)}>
                          <span className="request-avatar">{r.initials}</span>
                          <span className="request-main"><span><strong>{r.customer}</strong><i className={r.status === "Cotizada" ? "quoted" : ""}>{sdMap[r.status] ?? r.status}</i></span><b>{r.vehicle}</b><small>{r.issue}</small></span>
                          <span className="request-meta"><strong>{r.value}</strong><small>{r.distance} · {r.time}</small><ChevronRight size={17} /></span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="panel schedule-panel">
                  <div className="panel-title">
                    <div><h2>{t("todaySchedule")}</h2><p>{t("scheduleDate")}</p></div>
                    <button onClick={() => setActive(t("tabCitas"))}><Calendar size={17} /></button>
                  </div>
                  <div className="timeline">
                    <div><time>8:30</time><span className="timeline-dot active" /><article><strong>Cambio de aceite e inspección</strong><p>Taylor Kim · Subaru Outback 2020</p><i>En proceso</i></article></div>
                    <div><time>10:00</time><span className="timeline-dot" /><article><strong>Diagnóstico de frenos</strong><p>Marcus Hill · Chevrolet Malibu 2018</p><i className="scheduled">Confirmada</i></article></div>
                    <div><time>11:30</time><span className="timeline-dot" /><article><strong>El aire acondicionado no enfría</strong><p>Ana Cruz · Honda Civic 2016</p><i className="scheduled">Confirmada</i></article></div>
                    <div><time>1:00</time><span className="timeline-dot empty" /><article className="open-slot"><strong>{t("openSlotLabel")}</strong><button onClick={() => setBookingOpen(true)}>{t("reserveBtn")}</button></article></div>
                  </div>
                </div>
              </section>

              <section className="shop-bottom-grid">
                <article className="ai-workbench">
                  <span className="ai-large"><Bot /></span>
                  <div>
                    <span className="eyebrow"><Sparkles size={14} /> {t("workbenchEyebrow")}</span>
                    <h2>{t("workbenchTitle")}</h2>
                    <p>{t("workbenchDesc")}</p>
                  </div>
                  <button onClick={() => setActive(t("tabScout"))}>{t("workbenchBtn")} <ArrowRight size={17} /></button>
                </article>
                <article className="conversion-card">
                  <div className="panel-title"><div><h2>{t("conversionTitle")}</h2><p>{t("conversionPeriod")}</p></div></div>
                  <div className="conversion-stat"><strong>68%</strong><span>{t("conversionRate")}<em>↑ 8%</em></span></div>
                  <div className="bar"><i /></div>
                  <div className="mini-stats"><span><strong>42</strong>{t("conversionSent")}</span><span><strong>29</strong>{t("conversionApproved")}</span><span><strong>$412</strong>{t("conversionAvg")}</span></div>
                </article>
              </section>
            </>
          )}

          {active === t("tabSolicitudes") && (
            <RequestsFullPanel requests={visibleRequests} onSelect={setSelectedRequest} />
          )}

          {(active === (lang === "en" ? "Sent Quotes" : "Cotizaciones")) && (
            <SentQuotesPanel user={user} />
          )}

          {active === t("tabCitas") && (
            <AppointmentsPanel onBook={() => setBookingOpen(true)} />
          )}

          {active === t("tabOrdenes") && <WorkOrdersPanel user={user} />}

          {active === t("tabClientes") && <CustomersPanel requests={visibleRequests} />}

          {active === t("tabPiezas") && <PartsSearchPanel />}

          {active === t("tabScout") && <ScoutPanel />}

          {active === "Admin" && <AdminPanel />}
        </div>
      </div>

      {/* Quote request drawer */}
      {selectedRequest && (
        <div className="modal-backdrop" onClick={() => setSelectedRequest(null)}>
          <section className="quote-drawer" onClick={(e) => e.stopPropagation()}>
            <button className="drawer-close" onClick={() => setSelectedRequest(null)}><X /></button>
            <span className="eyebrow dark"><FileCheck2 size={15} /> {t("quoteDrawerEyebrow")}</span>
            <h2>{selectedRequest.vehicle}</h2>
            <p className="drawer-customer">{selectedRequest.customer} · {selectedRequest.distance}</p>
            <div className="concern-box">
              <small>{t("clientProblem")}</small>
              <strong>{selectedRequest.issue}</strong>
            </div>
            <h3>{t("aiStartingPoint")}</h3>
            <div className="drawer-check"><Check size={16} /><span><strong>{t("check1")}</strong>{t("check1Desc")}</span></div>
            <div className="drawer-check"><Check size={16} /><span><strong>{t("check2")}</strong>{t("check2Desc")}</span></div>
            <div className="draft-total"><span>{t("clientRange")}</span><strong>{selectedRequest.value}</strong></div>
            {selectedRequest.id && (
              <div className="status-actions">
                <small>{t("updateStatus")}</small>
                {quoteStatuses.map((status) => (
                  <button key={status} className={selectedRequest.status === status ? "active" : ""}
                    disabled={statusUpdating === `${selectedRequest.id}:${status}`}
                    onClick={() => changeRequestStatus(selectedRequest, status)}>
                    {statusUpdating === `${selectedRequest.id}:${status}` ? t("saving") : (statusDisplay[lang]?.[status] ?? status)}
                  </button>
                ))}
              </div>
            )}
            <button
              className="primary full"
              onClick={() => buildShopQuote(selectedRequest)}
              disabled={shopQuoteBuilding}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              {shopQuoteBuilding
                ? (lang === "en" ? "Building quote…" : "Generando cotización…")
                : <><PackageSearch size={15} /> {lang === "en" ? "Build & Send Quote" : "Generar y enviar cotización"}</>}
            </button>
            <button className="outline full" onClick={() => { setSelectedRequest(null); setActive(t("tabScout")); }}>
              {t("openDiagBtn")} <ArrowRight size={17} />
            </button>
            <button className="outline full" onClick={() => openMessage(selectedRequest)}>
              {t("sendMsgBtn")}
            </button>
          </section>
        </div>
      )}

      {bookingOpen && <BookingModal onClose={() => setBookingOpen(false)} />}
      {messageOpen && <MessageModal request={messageTarget} onClose={() => { setMessageOpen(false); setMessageTarget(null); }} />}

      {/* ── Global search overlay ── */}
      {searchOpen && (
        <div style={{ position: "fixed", inset: 0, background: "#000a", zIndex: 300, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 80 }}
          onClick={(e) => { if (e.target === e.currentTarget) setSearchOpen(false); }}>
          <div style={{ background: "#0d1829", border: "1px solid #1e2d47", borderRadius: 12, width: "100%", maxWidth: 520, boxShadow: "0 16px 48px #0009", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: "1px solid #1e2d47" }}>
              <Search size={16} color="#64748b" />
              <input
                autoFocus
                placeholder={isEn ? "Search customers, vehicles, quotes…" : "Buscar clientes, vehículos, cotizaciones…"}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ flex: 1, background: "none", border: "none", color: "#e2e8f0", fontSize: 14, outline: "none", fontFamily: "inherit" }}
              />
              <button onClick={() => setSearchOpen(false)} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>×</button>
            </div>
            <div style={{ maxHeight: 360, overflowY: "auto" }}>
              {visibleRequests
                .filter((r) => {
                  const q = searchQuery.toLowerCase();
                  return !q || r.customer?.toLowerCase().includes(q) || r.vehicle?.toLowerCase().includes(q) || r.issue?.toLowerCase().includes(q) || r.estimate?.toLowerCase().includes(q);
                })
                .slice(0, 10)
                .map((r) => (
                  <button key={r.id || r.customer} onClick={() => { setSelectedRequest(r); setSearchOpen(false); setSearchQuery(""); }}
                    style={{ width: "100%", background: "none", border: "none", borderBottom: "1px solid #1e2d4744", padding: "12px 16px", textAlign: "left", cursor: "pointer", display: "flex", gap: 12, alignItems: "center" }}>
                    <span style={{ width: 36, height: 36, borderRadius: "50%", background: "#1e3a5f", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "#93c5fd", fontSize: 12, flexShrink: 0 }}>{r.initials}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontWeight: 700, color: "#e2e8f0", fontSize: 13 }}>{r.customer}</span>
                      <span style={{ display: "block", fontSize: 11, color: "#94a3b8" }}>{r.vehicle}</span>
                      <span style={{ display: "block", fontSize: 10, color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.issue}</span>
                    </span>
                    <span style={{ fontWeight: 800, color: "#f1f5f9", fontSize: 13, flexShrink: 0 }}>{r.value || r.estimate}</span>
                  </button>
                ))}
              {searchQuery && visibleRequests.filter((r) => {
                const q = searchQuery.toLowerCase();
                return r.customer?.toLowerCase().includes(q) || r.vehicle?.toLowerCase().includes(q) || r.issue?.toLowerCase().includes(q);
              }).length === 0 && (
                <p style={{ padding: "20px 16px", fontSize: 12, color: "#64748b" }}>{isEn ? "No results found." : "Sin resultados."}</p>
              )}
            </div>
          </div>
        </div>
      )}
      {shopSendQuoteOpen && shopQuoteData && (
        <SendQuoteModal
          quoteData={shopQuoteData}
          selectedOption="combo"
          vehicle={shopQuoteData.vehicle}
          lang={lang}
          onClose={() => { setShopSendQuoteOpen(false); setShopQuoteData(null); }}
          onSent={() => {}}
        />
      )}
    </main>
  );
}

function LegalPage({ page, setPage }) {
  const content = {
    privacy: {
      icon: ShieldCheck, eyebrow: "Privacidad y datos", title: "Privacidad de RepairScout",
      intro: "Recopilamos solo la información necesaria para orientar una reparación, guardar tu cuenta y enviar solicitudes a talleres cuando tú lo autorizas.",
      sections: [
        ["Datos que guardamos", "Cuenta, vehículo, VIN si lo ingresas, descripción del problema, código postal, diagnósticos preliminares y solicitudes de cotización."],
        ["Cómo se usa", "Para generar orientación preliminar, buscar talleres, crear solicitudes de cotización y mejorar la seguridad del servicio."],
        ["Cuándo se comparte", "Solo compartimos los detalles de una solicitud con el taller que eliges. No vendemos información personal."],
        ["Tus controles", "Puedes pedir corrección o eliminación de tus datos escribiendo a support@repairscout.app. Agregaremos autoservicio de eliminación en una próxima versión."],
      ],
    },
    terms: {
      icon: FileCheck2, eyebrow: "Términos de uso", title: "Términos de RepairScout",
      intro: "RepairScout ayuda a organizar información, costos preliminares y comunicación. No reemplaza una inspección profesional ni una cotización final del taller.",
      sections: [
        ["Evaluación preliminar", "La IA puede equivocarse. Toda reparación debe verificarse con pruebas físicas, mediciones y revisión profesional."],
        ["Precios y disponibilidad", "Los rangos de piezas y mano de obra son orientativos hasta conectar proveedores licenciados y confirmación directa del taller."],
        ["Talleres", "Cada taller es responsable por su diagnóstico, autorización, reparación, garantía y comunicación con el cliente."],
        ["Uso seguro", "Si hay pérdida de frenos, humo, sobrecalentamiento, olor a combustible o luces rojas, deja de conducir y busca ayuda inmediata."],
      ],
    },
    support: {
      icon: Headphones, eyebrow: "Soporte", title: "¿Necesitas ayuda con RepairScout?",
      intro: "Estamos preparando el soporte completo. Por ahora, usa esta página como centro de confianza para clientes, familia, talleres y primeros testers.",
      sections: [
        ["Conductores", "Describe el síntoma con detalle, agrega el VIN si lo tienes y solicita cotización solo cuando estés listo para compartir el caso con un taller."],
        ["Talleres", "Revisa la solicitud como punto de partida, confirma con pruebas y envía una cotización final clara antes de pedir autorización."],
        ["Contacto", "support@repairscout.app"],
        ["Próximo paso", "Agregaremos mensajes, eliminación de cuenta, verificación de correo, recuperación de contraseña y seguimiento de citas."],
      ],
    },
  }[page];
  const Icon = content.icon;

  return (
    <main className="legal-page">
      <section className="legal-card">
        <button className="text-button legal-back" onClick={() => setPage("home")}>← Volver a RepairScout</button>
        <span className="eyebrow dark"><Icon size={15} /> {content.eyebrow}</span>
        <h1>{content.title}</h1>
        <p>{content.intro}</p>
        <div className="legal-grid">
          {content.sections.map(([title, body]) => (
            <article key={title}><h2>{title}</h2><p>{body}</p></article>
          ))}
        </div>
        <div className="legal-warning">
          <Trash2 size={18} />
          <span>Para eliminación de datos o preguntas legales, escribe desde el correo de tu cuenta. Esta vista es una versión inicial para el lanzamiento privado.</span>
        </div>
      </section>
    </main>
  );
}

function LandingPage({ setPortal, onAuth, setPage }) {
  const { lang, setLang } = useLang();
  const isEn = lang === "en";

  const copy = {
    badge: isEn ? "AI-Powered Auto Repair" : "Reparación automotriz con IA",
    h1a: isEn ? "Know your car." : "Conoce tu auto.",
    h1b: isEn ? "Trust your shop." : "Confía en tu taller.",
    sub: isEn
      ? "RepairScout diagnoses your vehicle with AI, shows you real local parts pricing, and connects you to trusted shops — all before you spend a dollar."
      : "RepairScout diagnostica tu vehículo con IA, muestra precios reales de piezas locales y te conecta con talleres de confianza — antes de gastar un centavo.",

    driverLabel: isEn ? "For Drivers" : "Para conductores",
    driverTitle: isEn ? "Diagnose my car" : "Diagnosticar mi auto",
    driverSub: isEn ? "Get an AI repair estimate in minutes" : "Obtén una estimación de reparación en minutos",

    shopLabel: isEn ? "For Shops" : "Para talleres",
    shopTitle: isEn ? "Manage my shop" : "Gestionar mi taller",
    shopSub: isEn ? "Send quotes, track repairs, close more jobs" : "Envía cotizaciones y cierra más trabajos",

    t1: isEn ? "AI Diagnosis" : "Diagnóstico con IA",
    t2: isEn ? "Local Pricing" : "Precios locales",
    t3: isEn ? "Bilingual" : "Bilingüe",
    t4: isEn ? "Free to start" : "Gratis para empezar",

    pathsTitle: isEn ? "Two portals. One platform." : "Dos portales. Una plataforma.",
    pathsSub: isEn
      ? "Whether you drive or turn wrenches, RepairScout works for you."
      : "Ya sea que manejes o seas mecánico, RepairScout trabaja para ti.",

    driverCardTitle: isEn ? "For Drivers" : "Para conductores",
    driverCardSub: isEn
      ? "Know what's wrong, what it costs, and which shop to trust — before you commit."
      : "Sabe qué está mal, cuánto cuesta y en qué taller confiar — antes de comprometerte.",
    ds1t: isEn ? "Describe your symptoms" : "Describe tus síntomas",
    ds1s: isEn ? "Type what you hear, feel, or see" : "Escribe lo que escuchas, sientes o ves",
    ds2t: isEn ? "Get an AI diagnosis" : "Obtén un diagnóstico con IA",
    ds2s: isEn ? "Possible causes with urgency ratings" : "Causas posibles con niveles de urgencia",
    ds3t: isEn ? "Compare local shops" : "Compara talleres locales",
    ds3s: isEn ? "Real parts pricing, no surprises" : "Precios reales de piezas, sin sorpresas",
    driverBtn: isEn ? "Start my diagnosis →" : "Iniciar mi diagnóstico →",

    shopCardTitle: isEn ? "For Shop Owners" : "Para dueños de talleres",
    shopCardSub: isEn
      ? "Respond to customer requests, send itemized quotes by text or email, and track every repair."
      : "Responde solicitudes, envía cotizaciones detalladas por texto o correo, y rastrea cada reparación.",
    ss1t: isEn ? "Receive repair requests" : "Recibe solicitudes de reparación",
    ss1s: isEn ? "From drivers in your area" : "De conductores en tu área",
    ss2t: isEn ? "Send itemized quotes" : "Envía cotizaciones detalladas",
    ss2s: isEn ? "Via SMS or email, parts + labor" : "Por SMS o correo, piezas + mano de obra",
    ss3t: isEn ? "Track repair progress" : "Rastrea el progreso de reparación",
    ss3s: isEn ? "6-stage timeline visible to customer" : "Línea de tiempo de 6 etapas visible al cliente",
    shopBtn: isEn ? "Open shop dashboard →" : "Abrir panel del taller →",

    featTitle: isEn ? "Built for real shops. Built for real drivers." : "Hecho para talleres reales. Para conductores reales.",
    featSub: isEn
      ? "Every feature exists because someone needed it."
      : "Cada función existe porque alguien la necesitó.",
    feats: isEn ? [
      { title: "AI-Powered Diagnosis", desc: "Groq & Gemini analyze your symptoms and return probable causes with urgency levels in seconds." },
      { title: "Local Parts Pricing", desc: "AutoZone, O'Reilly, Advance, NAPA and RockAuto prices compared for every repair — best price and single-store options." },
      { title: "SMS & Email Quotes", desc: "Shops send itemized quotes directly to customers. Customers approve with one tap." },
      { title: "Repair Status Tracker", desc: "6-stage repair timeline: Quote Sent → Approved → Parts Ordered → In Progress → Ready → Completed." },
      { title: "Bilingual EN / ES", desc: "Full English and Spanish support throughout the app — switch at any time." },
      { title: "VIN Decoder", desc: "Paste a VIN to auto-fill year, make, model, trim, and engine — no manual entry." },
    ] : [
      { title: "Diagnóstico con IA", desc: "Groq y Gemini analizan tus síntomas y devuelven causas probables con niveles de urgencia en segundos." },
      { title: "Precios de piezas locales", desc: "Precios de AutoZone, O'Reilly, Advance, NAPA y RockAuto comparados para cada reparación." },
      { title: "Cotizaciones por SMS y correo", desc: "Los talleres envían cotizaciones detalladas directamente a los clientes. Los clientes aprueban con un toque." },
      { title: "Rastreador de estado de reparación", desc: "Línea de tiempo de 6 etapas: Cotización enviada → Aprobada → Piezas ordenadas → En progreso → Lista → Completada." },
      { title: "Bilingüe EN / ES", desc: "Soporte completo en inglés y español en toda la aplicación — cambia en cualquier momento." },
      { title: "Decodificador de VIN", desc: "Pega un VIN para autocompletar año, marca, modelo, versión y motor — sin entrada manual." },
    ],

    bottomTitle: isEn ? "Ready to get started?" : "¿Listo para comenzar?",
    bottomSub: isEn ? "Free for drivers. Built for shops." : "Gratis para conductores. Hecho para talleres.",
    login: isEn ? "Sign in" : "Iniciar sesión",
  };

  const featIcons = [<Bot size={20} />, <PackageSearch size={20} />, <Send size={20} />, <Clock3 size={20} />, <MessageSquareText size={20} />, <Car size={20} />];

  return (
    <div>
      {/* Top bar */}
      <header className="lp-bar">
        <Brand />
        <div className="lp-bar-actions">
          <button className="lp-lang" onClick={() => setLang(lang === "es" ? "en" : "es")}>
            {lang === "es" ? "EN" : "ES"}
          </button>
          <button className="lp-login" onClick={onAuth}>{copy.login}</button>
        </div>
      </header>

      {/* Hero */}
      <section className="lp-hero">
        <div className="lp-badge">
          <Sparkles size={13} />
          {copy.badge}
        </div>
        <h1>{copy.h1a}<br /><em>{copy.h1b}</em></h1>
        <p>{copy.sub}</p>

        <div className="lp-split-cta">
          <button className="lp-cta-card driver" onClick={() => setPortal("customer")}>
            <span className="lp-cta-label">{copy.driverLabel}</span>
            <span className="lp-cta-title"><Car size={18} />{copy.driverTitle}</span>
            <span className="lp-cta-sub">{copy.driverSub}</span>
          </button>
          <button className="lp-cta-card shop" onClick={() => setPortal("shop")}>
            <span className="lp-cta-label">{copy.shopLabel}</span>
            <span className="lp-cta-title"><Wrench size={18} />{copy.shopTitle}</span>
            <span className="lp-cta-sub">{copy.shopSub}</span>
          </button>
        </div>

        <div className="lp-trust">
          <span><Check size={14} />{copy.t1}</span>
          <span><Check size={14} />{copy.t2}</span>
          <span><Check size={14} />{copy.t3}</span>
          <span><Check size={14} />{copy.t4}</span>
        </div>
      </section>

      {/* Two paths */}
      <section className="lp-paths">
        <div className="lp-paths-head">
          <div className="eyebrow dark"><Users size={14} />{isEn ? "Choose your path" : "Elige tu camino"}</div>
          <h2>{copy.pathsTitle}</h2>
          <p>{copy.pathsSub}</p>
        </div>
        <div className="lp-paths-grid">
          {/* Driver card */}
          <div className="lp-path-card driver-card">
            <div className="lp-path-icon"><Car size={24} /></div>
            <h3>{copy.driverCardTitle}</h3>
            <p>{copy.driverCardSub}</p>
            <div className="lp-steps">
              {[
                [copy.ds1t, copy.ds1s],
                [copy.ds2t, copy.ds2s],
                [copy.ds3t, copy.ds3s],
              ].map(([t, s], i) => (
                <div className="lp-step" key={i}>
                  <span className="lp-step-num">{i + 1}</span>
                  <div><strong>{t}</strong><span>{s}</span></div>
                </div>
              ))}
            </div>
            <button className="lp-path-btn" onClick={() => setPortal("customer")}>
              {copy.driverBtn}
            </button>
          </div>

          {/* Shop card */}
          <div className="lp-path-card shop-card">
            <div className="lp-path-icon"><Store size={24} /></div>
            <h3>{copy.shopCardTitle}</h3>
            <p>{copy.shopCardSub}</p>
            <div className="lp-steps">
              {[
                [copy.ss1t, copy.ss1s],
                [copy.ss2t, copy.ss2s],
                [copy.ss3t, copy.ss3s],
              ].map(([t, s], i) => (
                <div className="lp-step" key={i}>
                  <span className="lp-step-num">{i + 1}</span>
                  <div><strong>{t}</strong><span>{s}</span></div>
                </div>
              ))}
            </div>
            <button className="lp-path-btn" onClick={() => setPortal("shop")}>
              {copy.shopBtn}
            </button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="lp-features">
        <div className="lp-features-head">
          <div className="eyebrow dark"><Sparkles size={14} />{isEn ? "Everything you need" : "Todo lo que necesitas"}</div>
          <h2>{copy.featTitle}</h2>
          <p>{copy.featSub}</p>
        </div>
        <div className="lp-feat-grid">
          {copy.feats.map((f, i) => (
            <div className="lp-feat" key={i}>
              <div className="lp-feat-icon">{featIcons[i]}</div>
              <h4>{f.title}</h4>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="lp-bottom-cta">
        <h2>{copy.bottomTitle}</h2>
        <p>{copy.bottomSub}</p>
        <div className="lp-bottom-btns">
          <button className="lp-cta-card driver" onClick={() => setPortal("customer")}>
            <span className="lp-cta-label">{copy.driverLabel}</span>
            <span className="lp-cta-title"><Car size={18} />{copy.driverTitle}</span>
          </button>
          <button className="lp-cta-card shop" onClick={() => setPortal("shop")}>
            <span className="lp-cta-label">{copy.shopLabel}</span>
            <span className="lp-cta-title"><Wrench size={18} />{copy.shopTitle}</span>
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="lp-footer">
        <Brand />
        <span>© 2026 RepairScout</span>
        <button onClick={() => setPage("privacy")}>{isEn ? "Privacy" : "Privacidad"}</button>
        <button onClick={() => setPage("terms")}>{isEn ? "Terms" : "Términos"}</button>
      </footer>
    </div>
  );
}

function Footer({ setPage }) {
  const t = useT();
  return (
    <footer className="site-footer">
      <Brand />
      <p>{t("footerDesc")}</p>
      <nav>
        <button onClick={() => setPage("privacy")}>{t("privacyBtn")}</button>
        <button onClick={() => setPage("terms")}>{t("termsBtn")}</button>
        <button onClick={() => setPage("support")}>{t("supportBtn")}</button>
      </nav>
    </footer>
  );
}

function App() {
  const [portal, setPortal] = useState("landing");
  const [page, setPage] = useState("home");
  const [user, setUser] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [lang, setLang] = useState("es");

  // Detect /track/:token URL
  const [trackToken] = useState(() => {
    const match = window.location.pathname.match(/^\/track\/([a-f0-9]{20,})$/i);
    return match ? match[1] : null;
  });

  // Detect /diagnose/result?pid=xxx URL (post-Stripe return)
  const [diagnosePendingId] = useState(() => {
    if (window.location.pathname !== "/diagnose/result") return null;
    return new URLSearchParams(window.location.search).get("pid") || null;
  });

  useEffect(() => {
    if (!window.localStorage.getItem("repairscout_token")) return;
    getCurrentUser()
      .then(({ user: u }) => { setUser(u); setPortal(["shop", "admin"].includes(u.role) ? "shop" : "customer"); })
      .catch(() => window.localStorage.removeItem("repairscout_token"));
  }, []);

  const logout = () => { window.localStorage.removeItem("repairscout_token"); setUser(null); setPortal("landing"); };

  const handleSetPortal = (p) => { setPortal(p); setPage("home"); };

  return (
    <LangCtx.Provider value={{ lang, setLang }}>
      {(trackToken || diagnosePendingId) ? (
        <>
          <header className="topbar" style={{ justifyContent: "space-between" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "#1f7251" }}><Wrench size={18} strokeWidth={2.5} /></span>
              <span style={{ fontWeight: 700, color: "#17211d" }}>Repair<span style={{ color: "#1f7251" }}>Scout</span></span>
            </span>
            <button
              onClick={() => setLang(lang === "es" ? "en" : "es")}
              style={{ fontSize: 11, fontWeight: 700, padding: "5px 11px", borderRadius: 6, border: "1px solid #dfe5e1", background: "transparent", color: "#69736e", cursor: "pointer", fontFamily: "inherit" }}
            >{lang === "es" ? "EN" : "ES"}</button>
          </header>
          {trackToken ? <TrackPage token={trackToken} /> : <DiagnoseResultPage pendingId={diagnosePendingId} />}
        </>
      ) : portal === "landing" && page === "home" ? (
        <>
          <LandingPage
            setPortal={handleSetPortal}
            onAuth={() => setAuthOpen(true)}
            setPage={setPage}
          />
          {authOpen && <AuthModal onClose={() => setAuthOpen(false)} onAuthenticated={(u) => { setUser(u); setPortal(["shop", "admin"].includes(u.role) ? "shop" : "customer"); }} />}
        </>
      ) : (
        <>
          {(portal === "customer" || portal === "shop" || page !== "home") && (
            <TopBar portal={portal} setPortal={handleSetPortal} page={page} setPage={setPage} user={user} onAuth={() => setAuthOpen(true)} onLogout={logout} />
          )}
          {page === "home"
            ? portal === "customer"
              ? <CustomerPortal user={user} onRequireAuth={() => setAuthOpen(true)} />
              : <ShopPortal user={user} onRequireAuth={() => setAuthOpen(true)} />
            : <LegalPage page={page} setPage={setPage} />
          }
          {(portal === "customer" || portal === "shop" || page !== "home") && <Footer setPage={setPage} />}
          {authOpen && <AuthModal onClose={() => setAuthOpen(false)} onAuthenticated={(u) => { setUser(u); setPortal(["shop", "admin"].includes(u.role) ? "shop" : "customer"); }} />}
        </>
      )}
    </LangCtx.Provider>
  );
}

export default function AppWithBoundary() {
  return <ErrorBoundary><App /></ErrorBoundary>;
}
