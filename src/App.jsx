import React, { useEffect, useMemo, useState } from "react";
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
  Gauge,
  Headphones,
  LayoutDashboard,
  MapPin,
  Menu,
  MessageSquareText,
  PackageSearch,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Store,
  Trash2,
  UserRound,
  Users,
  Wrench,
  X,
} from "lucide-react";
import {
  diagnosisResults, partsResults, quoteRequests, shops as demoShops,
  diagnosisResultsEn, partsResultsEn, shopsEn, quoteRequestsEn,
} from "./demoData";
import {
  createDiagnosis,
  decodeVin,
  getCurrentUser,
  getQuoteRequests,
  getShopProfile,
  getSystemHealth,
  loginAccount,
  registerAccount,
  saveShopProfile,
  saveQuoteRequest,
  saveVehicle,
  searchShops,
  updateQuoteRequestStatus,
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
        <span className="eyebrow dark"><ShieldCheck size={15} /> Cuenta RepairScout</span>
        <h2>{mode === "register" ? "Crea tu cuenta" : "Bienvenido de nuevo"}</h2>
        <p>Guarda vehículos, diagnósticos y solicitudes de cotización.</p>
        {mode === "register" && (
          <>
            <label htmlFor="auth-name">Nombre</label>
            <input id="auth-name" value={form.name} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))} required />
            <label>Tipo de cuenta</label>
            <div className="role-picker">
              <button type="button" className={form.role === "driver" ? "active" : ""} onClick={() => setForm((c) => ({ ...c, role: "driver" }))}>Conductor</button>
              <button type="button" className={form.role === "shop" ? "active" : ""} onClick={() => setForm((c) => ({ ...c, role: "shop" }))}>Taller</button>
            </div>
            {form.role === "shop" && (
              <>
                <label htmlFor="shop-name">Nombre del taller</label>
                <input id="shop-name" value={form.shopName} onChange={(e) => setForm((c) => ({ ...c, shopName: e.target.value }))} required />
              </>
            )}
          </>
        )}
        <label htmlFor="auth-email">Correo electrónico</label>
        <input id="auth-email" type="email" value={form.email} onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))} required />
        <label htmlFor="auth-password">Contraseña</label>
        <input id="auth-password" type="password" minLength="8" value={form.password} onChange={(e) => setForm((c) => ({ ...c, password: e.target.value }))} required />
        {error && <p className="form-error">{error}</p>}
        <button className="primary full" disabled={loading}>{loading ? "Procesando..." : mode === "register" ? "Crear cuenta" : "Iniciar sesión"}</button>
        <button type="button" className="auth-switch" onClick={() => setMode((c) => c === "register" ? "login" : "register")}>
          {mode === "register" ? "¿Ya tienes cuenta? Inicia sesión" : "¿No tienes cuenta? Regístrate"}
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
  const apts = [
    { time: "8:30",  customer: "Taylor Kim",    vehicle: "Subaru Outback 2020",    service: "Cambio de aceite e inspección",  status: "active",     tech: "Carlos M." },
    { time: "10:00", customer: "Marcus Hill",    vehicle: "Chevrolet Malibu 2018",  service: "Diagnóstico de frenos",          status: "scheduled",  tech: "Ana V." },
    { time: "11:30", customer: "Ana Cruz",       vehicle: "Honda Civic 2016",       service: "El A/C no enfría",               status: "scheduled",  tech: "Luis R." },
    { time: "1:00",  customer: null,             vehicle: null,                     service: null,                             status: "open",       tech: null },
    { time: "2:30",  customer: "Roberto Paz",    vehicle: "Toyota Camry 2021",      service: "Revisión pre-viaje",             status: "scheduled",  tech: "Carlos M." },
    { time: "4:00",  customer: null,             vehicle: null,                     service: null,                             status: "open",       tech: null },
  ];

  return (
    <section className="panel">
      <div className="panel-title">
        <div>
          <h2>Agenda del día</h2>
          <p>Sábado, 20 de junio · {apts.filter((a) => a.status !== "open").length} citas · {apts.filter((a) => a.status === "open").length} espacios disponibles</p>
        </div>
        <button className="primary small" onClick={onBook}>+ Nueva cita</button>
      </div>
      <div className="timeline">
        {apts.map((a) => (
          <div key={a.time}>
            <time>{a.time}</time>
            <span className={`timeline-dot${a.status === "active" ? " active" : a.status === "open" ? " empty" : ""}`} />
            <article>
              {a.status === "open" ? (
                <div className="open-slot"><strong>Cita disponible</strong><button onClick={onBook}>Reservar</button></div>
              ) : (
                <>
                  <strong>{a.service}</strong>
                  <p>{a.customer} · {a.vehicle}</p>
                  <i className={a.status === "active" ? "" : "scheduled"}>{a.status === "active" ? "En proceso" : "Confirmada"} · {a.tech}</i>
                </>
              )}
            </article>
          </div>
        ))}
      </div>
    </section>
  );
}

function WorkOrdersPanel() {
  const orders = [
    { id: "WO-041", customer: "Taylor Kim",    vehicle: "Subaru Outback 2020",   service: "Cambio de aceite e inspección",    status: "En proceso",              tech: "Carlos M.", est: "$89",    odo: "58,200" },
    { id: "WO-040", customer: "Diana Torres",  vehicle: "Ford F-150 2019",       service: "Reemplazo de pastillas de freno",  status: "En espera de piezas",     tech: "Ana V.",    est: "$280",   odo: "94,100" },
    { id: "WO-039", customer: "Sam Okoro",     vehicle: "Tesla Model 3 2022",    service: "Diagnóstico de advertencia",       status: "Pendiente de aprobación", tech: "Luis R.",   est: "—",      odo: "22,400" },
    { id: "WO-038", customer: "Marcus Hill",   vehicle: "Chevrolet Malibu 2018", service: "Diagnóstico de frenos",            status: "Programada",              tech: "Ana V.",    est: "$320",   odo: "88,750" },
    { id: "WO-037", customer: "Ana Cruz",      vehicle: "Honda Civic 2016",      service: "Reparación de A/C",               status: "Programada",              tech: "Luis R.",   est: "$540",   odo: "71,330" },
  ];
  const colors = { "En proceso": "#4ade80", "En espera de piezas": "#fbbf24", "Pendiente de aprobación": "#f97316", "Programada": "#60a5fa", "Completada": "#94a3b8" };

  return (
    <section className="panel">
      <div className="panel-title">
        <div><h2>Órdenes de trabajo</h2><p>{orders.length} activas</p></div>
        <button className="primary small">+ Nueva orden</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
        {orders.map((o) => (
          <article key={o.id} className="card" style={{
            padding: "14px 18px", display: "grid", gridTemplateColumns: "64px 1fr auto",
            gap: 16, alignItems: "center", cursor: "pointer", border: "1px solid #151c2a", transition: "border .2s",
          }}>
            <span style={{ fontSize: 10, color: "#475569", fontFamily: "monospace", fontWeight: 600 }}>{o.id}</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: "#f1f5f9", marginBottom: 3 }}>{o.service}</div>
              <div style={{ fontSize: 11, color: "#64748b" }}>{o.customer} · {o.vehicle} · {o.odo} mi · {o.tech}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, color: "#f1f5f9", fontWeight: 600, marginBottom: 5 }}>{o.est}</div>
              <span style={{
                fontSize: 9, padding: "3px 8px", borderRadius: 20,
                border: `1px solid ${colors[o.status]}44`, color: colors[o.status], background: `${colors[o.status]}11`,
              }}>{o.status}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function CustomersPanel({ requests }) {
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
        <div><h2>Clientes</h2><p>{allCustomers.length} registrados</p></div>
      </div>
      <input
        placeholder="Buscar por nombre o vehículo..."
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

function PartsSearchPanel() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(partsResults);
  const [searching, setSearching] = useState(false);

  const search = () => {
    if (!query.trim()) { setResults(partsResults); return; }
    setSearching(true);
    setTimeout(() => {
      const q = query.toLowerCase();
      const found = partsResults.filter((p) => p.part.toLowerCase().includes(q) || p.seller.toLowerCase().includes(q));
      setResults(found.length ? found : partsResults);
      setSearching(false);
    }, 400);
  };

  return (
    <section className="panel">
      <div className="panel-title">
        <div><h2>Búsqueda de piezas</h2><p>Inventario local y en línea en tiempo real</p></div>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          placeholder="Ej: pastillas de freno Honda Accord 2019..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          style={{
            flex: 1, background: "#0a1020", border: "1px solid #1e2d47", color: "#e2e8f0",
            padding: "10px 14px", borderRadius: 6, fontSize: 12, fontFamily: "inherit", outline: "none",
          }}
        />
        <button className="primary" onClick={search} disabled={searching} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {searching ? "Buscando..." : <><Search size={15} /> Buscar</>}
        </button>
      </div>
      <div className="parts-table">
        <div className="table-head"><span>Vendedor y pieza</span><span>Disponibilidad</span><span>Garantía</span><span>Precio</span></div>
        {results.map((p) => (
          <div className="part-row" key={p.seller}>
            <div className="seller-cell">
              <span className="seller-icon"><Store size={20} /></span>
              <span><strong>{p.seller}</strong><small>{p.part}</small><i>{p.badge}</i></span>
            </div>
            <div><strong>{p.availability}</strong><small>{p.distance}</small></div>
            <div><strong>{p.warranty}</strong><small>Consulta los términos</small></div>
            <div className="part-price">
              ${p.price.toFixed(2)}
              <button onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(p.part + " " + p.seller)}`, "_blank")}>Ver</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ScoutPanel() {
  const { lang } = useLang();
  const t = useT();
  const [query, setQuery] = useState("");
  const [vehicle, setVehicle] = useState({ year: "2019", make: "Honda", model: "Accord" });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const r = await createDiagnosis({ vehicle, mileage: "62,000", description: query, zip: "95814", language: lang });
      setResult(r);
    } catch (e) {
      setResult({ error: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="panel">
      <div className="panel-title">
        <div>
          <span className="eyebrow dark"><Sparkles size={14} /> {t("scoutEyebrow")}</span>
          <h2>{t("scoutTitle")}</h2>
          <p>{t("scoutDesc")}</p>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
        {[[t("scoutYear"), "year"], [t("scoutMake"), "make"], [t("scoutModel"), "model"]].map(([label, key]) => (
          <label key={key} style={{ fontSize: 10, color: "#64748b" }}>
            {label}
            <input
              value={vehicle[key]}
              onChange={(e) => setVehicle((v) => ({ ...v, [key]: e.target.value }))}
              style={{
                width: "100%", marginTop: 4, background: "#0a1020", border: "1px solid #1e2d47",
                color: "#e2e8f0", padding: "8px 10px", borderRadius: 4, fontSize: 11, fontFamily: "inherit", outline: "none", display: "block",
              }}
            />
          </label>
        ))}
      </div>
      <textarea
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("scoutPlaceholder")}
        rows={4}
        style={{
          width: "100%", background: "#0a1020", border: "1px solid #1e2d47", color: "#e2e8f0",
          padding: "12px 14px", borderRadius: 6, fontSize: 12, fontFamily: "inherit", outline: "none",
          resize: "vertical", marginBottom: 12,
        }}
      />
      <button className="primary full" onClick={run} disabled={loading || !query.trim()} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        {loading ? t("scoutAnalyzing") : <><Bot size={16} /> {t("scoutBtn")}</>}
      </button>

      {result && !result.error && (
        <div style={{ marginTop: 20 }}>
          {result.possibleCauses?.map((c, i) => (
            <article key={c.title} className="card" style={{
              padding: "14px 16px", marginBottom: 8,
              border: i === 0 ? "1px solid rgba(249,115,22,.3)" : "1px solid #151c2a",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <strong style={{ fontSize: 13, color: "#f1f5f9" }}>{c.title}</strong>
                <span style={{
                  fontSize: 10, color: i === 0 ? "#f97316" : "#64748b",
                  border: `1px solid ${i === 0 ? "rgba(249,115,22,.3)" : "#1e2d47"}`,
                  borderRadius: 3, padding: "2px 7px",
                }}>{c.probability}%</span>
              </div>
              <p style={{ fontSize: 11, color: "#64748b", lineHeight: 1.6, marginBottom: 4 }}>{c.reason}</p>
              <small style={{ fontSize: 10, color: "#475569", display: "flex", alignItems: "center", gap: 4 }}>
                <Search size={11} /> {t("scoutVerify")} {c.test}
              </small>
            </article>
          ))}
          {result.estimate && (
            <div className="card" style={{
              padding: "14px 16px", marginTop: 8,
              background: "rgba(249,115,22,.04)", border: "1px solid rgba(249,115,22,.12)",
            }}>
              <div style={{ fontSize: 10, color: "#f97316", marginBottom: 4, letterSpacing: ".1em" }}>{t("scoutEstimate")}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#f1f5f9" }}>${result.estimate.low}–${result.estimate.high}</div>
              <p style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>{result.estimate.repairLabel}</p>
            </div>
          )}
        </div>
      )}
      {result?.error && <p className="form-error" style={{ marginTop: 12 }}>{result.error}</p>}
    </section>
  );
}

function BookingModal({ onClose }) {
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
        <span className="eyebrow dark"><Calendar size={15} /> Nueva cita</span>
        <h2>Reservar espacio</h2>
        {saved ? (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <div style={{ color: "#4ade80", fontWeight: 600, fontSize: 14 }}>Cita agendada correctamente</div>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {field("Cliente *", "customer", "Nombre completo")}
              {field("Vehículo", "vehicle", "Año Marca Modelo")}
              {field("Servicio *", "service", "Describe el servicio solicitado")}
              {field("Hora *", "time", "Ej: 1:00 PM")}
              {field("Técnico asignado", "tech", "Nombre del técnico")}
              <label style={{ fontSize: 10, color: "#64748b" }}>
                Notas
                <textarea
                  value={form.notes} rows={2}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Instrucciones especiales, historial previo..."
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
              <Calendar size={16} /> Confirmar cita
            </button>
          </>
        )}
      </section>
    </div>
  );
}

function MessageModal({ request, onClose }) {
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
        <span className="eyebrow dark"><MessageSquareText size={15} /> Mensaje al cliente</span>
        <h2>{request?.customer || "Cliente"}</h2>
        <p style={{ fontSize: 11, color: "#64748b", marginBottom: 16 }}>{request?.vehicle} · {request?.distance}</p>
        {sent ? (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✉️</div>
            <div style={{ color: "#4ade80", fontWeight: 600, fontSize: 14 }}>Mensaje enviado</div>
          </div>
        ) : (
          <>
            <textarea
              value={msg} rows={5}
              onChange={(e) => setMsg(e.target.value)}
              placeholder="Escribe tu mensaje para el cliente..."
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
              Enviar mensaje <ArrowRight size={16} />
            </button>
          </>
        )}
      </section>
    </div>
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

  const runAssessment = async () => {
    if (!description.trim()) return;
    setError(""); setLoading(true);
    try {
      const result = await createDiagnosis({ vehicle, mileage, description, zip, language: lang });
      setDiagnosis(result);
      setStep(1);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
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

  const steps = [t("step1"), t("step2"), t("step3"), t("step4")];
  const symptoms = [t("symptom1"), t("symptom2"), t("symptom3")];
  const confMap = confidenceDisplay[lang] || confidenceDisplay.es;

  return (
    <main>
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
          <label htmlFor="vin">{t("vinLabel")}</label>
          <div className="vin-row">
            <input id="vin" maxLength="17" value={vin} onChange={(e) => setVin(e.target.value.toUpperCase())} placeholder={t("vinPlaceholder")} />
            <button className="outline" onClick={lookupVin} disabled={vinLoading || vin.length !== 17}>
              {vinLoading ? t("vinLoading") : t("vinBtn")}
            </button>
          </div>
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
            </aside>
          </div>
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
    </main>
  );
}

/* ── Shop portal ── */

function Sidebar({ active, setActive, shopProfile }) {
  const t = useT();
  const links = [
    [t("tabResumen"), LayoutDashboard],
    [t("tabSolicitudes"), MessageSquareText],
    [t("tabCitas"), Calendar],
    [t("tabOrdenes"), Wrench],
    [t("tabClientes"), Users],
    [t("tabPiezas"), PackageSearch],
    [t("tabScout"), Bot],
    [t("tabPerfil"), Building2],
  ];

  return (
    <aside className="shop-sidebar">
      <Brand />
      <div className="shop-identity">
        <span>{(shopProfile?.shopName || "RS").slice(0, 2).toUpperCase()}</span>
        <div><strong>{shopProfile?.shopName || "Configura tu taller"}</strong><small>{shopProfile?.claimed ? t("claimed") : "Admin"}</small></div>
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
  const specialtyText = Array.isArray(profileForm.specialties) ? profileForm.specialties.join(", ") : "";
  return (
    <section className="panel shop-profile-panel">
      <div className="panel-title">
        <div><h2>Perfil del taller</h2><p>Estos datos preparan tu taller para recibir solicitudes reales y cotizar mejor.</p></div>
        <span className={profileForm.claimed ? "live-badge on" : "live-badge"}>{profileForm.claimed ? "Reclamado" : "Pendiente"}</span>
      </div>
      <div className="profile-form">
        <label>Nombre del taller<input value={profileForm.shopName || ""} onChange={(e) => setProfileForm((c) => ({ ...c, shopName: e.target.value }))} /></label>
        <label>Contacto principal<input value={profileForm.contactName || ""} onChange={(e) => setProfileForm((c) => ({ ...c, contactName: e.target.value }))} /></label>
        <label>Teléfono<input value={profileForm.phone || ""} onChange={(e) => setProfileForm((c) => ({ ...c, phone: e.target.value }))} /></label>
        <label>Correo del taller<input type="email" value={profileForm.email || ""} onChange={(e) => setProfileForm((c) => ({ ...c, email: e.target.value }))} /></label>
        <label className="wide">Dirección<input value={profileForm.address || ""} onChange={(e) => setProfileForm((c) => ({ ...c, address: e.target.value }))} /></label>
        <label>Ciudad<input value={profileForm.city || ""} onChange={(e) => setProfileForm((c) => ({ ...c, city: e.target.value }))} /></label>
        <label>Estado<input value={profileForm.state || ""} onChange={(e) => setProfileForm((c) => ({ ...c, state: e.target.value }))} /></label>
        <label>Código postal<input value={profileForm.zip || ""} onChange={(e) => setProfileForm((c) => ({ ...c, zip: e.target.value }))} /></label>
        <label>Tarifa de mano de obra<input value={profileForm.laborRate || ""} onChange={(e) => setProfileForm((c) => ({ ...c, laborRate: e.target.value }))} placeholder="$145/h" /></label>
        <label className="wide">Especialidades<input value={specialtyText} onChange={(e) => setProfileForm((c) => ({ ...c, specialties: e.target.value.split(",").map((i) => i.trim()).filter(Boolean) }))} placeholder="Frenos, suspensión, diagnóstico eléctrico" /></label>
        <label className="wide">Garantía<input value={profileForm.warranty || ""} onChange={(e) => setProfileForm((c) => ({ ...c, warranty: e.target.value }))} placeholder="12 meses / 12,000 millas" /></label>
        <label className="wide">Disponibilidad<input value={profileForm.availability || ""} onChange={(e) => setProfileForm((c) => ({ ...c, availability: e.target.value }))} placeholder="Lun–Vie 8am–6pm, sábados por cita" /></label>
      </div>
      {profileMessage && <p className="profile-message">{profileMessage}</p>}
      <button className="primary" onClick={onSave} disabled={profileSaving}>{profileSaving ? "Guardando..." : "Guardar y reclamar taller"} <Check size={17} /></button>
    </section>
  );
}

function ShopPortal({ user, onRequireAuth }) {
  const { lang } = useLang();
  const t = useT();
  const demoQR = lang === "en" ? quoteRequestsEn : quoteRequests;
  const [active, setActive] = useState(() => T[lang]?.tabResumen ?? "Resumen");

  useEffect(() => {
    setActive(T[lang]?.tabResumen ?? T.es.tabResumen);
  }, [lang]);
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

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([getQuoteRequests(), getShopProfile(), getSystemHealth()])
      .then(([rr, pr, hr]) => {
        if (cancelled) return;
        if (rr.status === "fulfilled") setSavedRequests(rr.value.quoteRequests);
        if (pr.status === "fulfilled") { setShopProfile(pr.value.profile); setProfileForm((c) => ({ ...c, ...pr.value.profile })); }
        if (hr.status === "fulfilled") setHealth(hr.value);
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

  return (
    <main className="shop-shell">
      <Sidebar active={active} setActive={setActive} shopProfile={shopProfile || profileForm} />
      <div className="shop-main">
        <header className="shop-header">
          <div>
            <span className="breadcrumb">{t("shopPortalBreadcrumb")} / {active}</span>
            <h1>{active === "Resumen" || active === "Overview" ? `${t("goodMorning")}${user?.name ? `, ${user.name.split(" ")[0]}` : ""}` : active}</h1>
          </div>
          <div className="shop-header-actions">
            {!user && <button className="outline compact" onClick={onRequireAuth}>{t("signInCreate")}</button>}
            <button className="icon-button"><Search size={19} /></button>
            <button className="icon-button"><Bell size={19} /><i /></button>
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
          {(active === t("tabPerfil") || !shopProfile?.claimed) && (
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

          {active === t("tabCitas") && (
            <AppointmentsPanel onBook={() => setBookingOpen(true)} />
          )}

          {active === t("tabOrdenes") && <WorkOrdersPanel />}

          {active === t("tabClientes") && <CustomersPanel requests={visibleRequests} />}

          {active === t("tabPiezas") && <PartsSearchPanel />}

          {active === t("tabScout") && <ScoutPanel />}
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
            <button className="primary full" onClick={() => { setSelectedRequest(null); setActive(t("tabScout")); }}>
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

export default function App() {
  const [portal, setPortal] = useState("customer");
  const [page, setPage] = useState("home");
  const [user, setUser] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [lang, setLang] = useState("es");

  useEffect(() => {
    if (!window.localStorage.getItem("repairscout_token")) return;
    getCurrentUser()
      .then(({ user: u }) => setUser(u))
      .catch(() => window.localStorage.removeItem("repairscout_token"));
  }, []);

  const logout = () => { window.localStorage.removeItem("repairscout_token"); setUser(null); setPortal("customer"); };

  return (
    <LangCtx.Provider value={{ lang, setLang }}>
      {(portal === "customer" || page !== "home") && <TopBar portal={portal} setPortal={setPortal} page={page} setPage={setPage} user={user} onAuth={() => setAuthOpen(true)} onLogout={logout} />}
      {page === "home"
        ? portal === "customer"
          ? <CustomerPortal user={user} onRequireAuth={() => setAuthOpen(true)} />
          : <ShopPortal user={user} onRequireAuth={() => setAuthOpen(true)} />
        : <LegalPage page={page} setPage={setPage} />
      }
      {(portal === "customer" || page !== "home") && <Footer setPage={setPage} />}
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} onAuthenticated={setUser} />}
    </LangCtx.Provider>
  );
}
