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
  UserRound,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { diagnosisResults, partsResults, quoteRequests, shops as demoShops } from "./demoData";
import {
  createDiagnosis,
  decodeVin,
  getCurrentUser,
  getQuoteRequests,
  loginAccount,
  registerAccount,
  saveQuoteRequest,
  saveVehicle,
  searchShops,
} from "./api";

const steps = ["Describe el problema", "Evaluación con IA", "Compara costos", "Elige un taller"];

function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark"><Wrench size={19} strokeWidth={2.5} /></span>
      <span>Repair<span>Scout</span></span>
    </div>
  );
}

function TopBar({ portal, setPortal, user, onAuth, onLogout }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="topbar">
      <Brand />
      <nav className={mobileOpen ? "main-nav open" : "main-nav"}>
        <button className={portal === "customer" ? "active" : ""} onClick={() => { setPortal("customer"); setMobileOpen(false); }}>
          Para conductores
        </button>
        <button className={portal === "shop" ? "active" : ""} onClick={() => { setPortal("shop"); setMobileOpen(false); }}>
          Para talleres
        </button>
        <button>Cómo funciona</button>
      </nav>
      <div className="top-actions">
        {user ? (
          <button className="account-chip" onClick={onLogout}><UserRound size={16} />{user.name}<small>Salir</small></button>
        ) : (
          <button className="text-button" onClick={onAuth}>Iniciar sesión</button>
        )}
        <button className="primary small" onClick={() => setPortal(portal === "customer" ? "shop" : "customer")}>
          {portal === "customer" ? "Portal del taller" : "Vista del conductor"}
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
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "driver",
    shopName: "",
  });
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
      <form className="auth-modal" onSubmit={submit} onClick={(event) => event.stopPropagation()}>
        <button type="button" className="drawer-close" onClick={onClose}><X /></button>
        <span className="eyebrow dark"><ShieldCheck size={15} /> Cuenta RepairScout</span>
        <h2>{mode === "register" ? "Crea tu cuenta" : "Bienvenido de nuevo"}</h2>
        <p>Guarda vehículos, diagnósticos y solicitudes de cotización.</p>
        {mode === "register" ? (
          <>
            <label htmlFor="auth-name">Nombre</label>
            <input id="auth-name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
            <label>Tipo de cuenta</label>
            <div className="role-picker">
              <button type="button" className={form.role === "driver" ? "active" : ""} onClick={() => setForm((current) => ({ ...current, role: "driver" }))}>Conductor</button>
              <button type="button" className={form.role === "shop" ? "active" : ""} onClick={() => setForm((current) => ({ ...current, role: "shop" }))}>Taller</button>
            </div>
            {form.role === "shop" ? (
              <>
                <label htmlFor="shop-name">Nombre del taller</label>
                <input id="shop-name" value={form.shopName} onChange={(event) => setForm((current) => ({ ...current, shopName: event.target.value }))} required />
              </>
            ) : null}
          </>
        ) : null}
        <label htmlFor="auth-email">Correo electrónico</label>
        <input id="auth-email" type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} required />
        <label htmlFor="auth-password">Contraseña</label>
        <input id="auth-password" type="password" minLength="8" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} required />
        {error ? <p className="form-error">{error}</p> : null}
        <button className="primary full" disabled={loading}>{loading ? "Procesando..." : mode === "register" ? "Crear cuenta" : "Iniciar sesión"}</button>
        <button type="button" className="auth-switch" onClick={() => setMode((current) => current === "register" ? "login" : "register")}>
          {mode === "register" ? "¿Ya tienes cuenta? Inicia sesión" : "¿No tienes cuenta? Regístrate"}
        </button>
      </form>
    </div>
  );
}

function CustomerPortal({ user, onRequireAuth }) {
  const [step, setStep] = useState(0);
  const [description, setDescription] = useState("Escucho un rechinido en la parte delantera cuando freno, especialmente a baja velocidad.");
  const [zip, setZip] = useState("95814");
  const [radius, setRadius] = useState("25 millas");
  const [requestedShops, setRequestedShops] = useState([]);
  const [vin, setVin] = useState("");
  const [vehicle, setVehicle] = useState({
    year: "2019",
    make: "Honda",
    model: "Accord",
    trim: "Sport",
    engine: "1.5L Turbo",
  });
  const [mileage, setMileage] = useState("62,410");
  const [diagnosis, setDiagnosis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [vinLoading, setVinLoading] = useState(false);
  const [error, setError] = useState("");
  const [availableShops, setAvailableShops] = useState(demoShops);
  const [shopsLoading, setShopsLoading] = useState(false);
  const [shopSource, setShopSource] = useState("demo");
  const [vehicleSaved, setVehicleSaved] = useState(false);

  const estimatedTotal = useMemo(() => {
    if (diagnosis?.estimate) {
      return { low: diagnosis.estimate.low, high: diagnosis.estimate.high };
    }
    const lowestPart = Math.min(...partsResults.map((part) => part.price));
    return { low: Math.round(lowestPart + 190), high: Math.round(lowestPart + 365) };
  }, [diagnosis]);

  const displayedCauses = diagnosis?.possibleCauses || diagnosisResults;

  const lookupVin = async () => {
    setError("");
    setVinLoading(true);
    try {
      const decoded = await decodeVin(vin);
      setVehicle(decoded);
    } catch (lookupError) {
      setError(lookupError.message);
    } finally {
      setVinLoading(false);
    }
  };

  const runAssessment = async () => {
    if (!description.trim()) return;
    setError("");
    setLoading(true);
    try {
      const result = await createDiagnosis({
        vehicle,
        mileage,
        description,
        zip,
      });
      setDiagnosis(result);
      setStep(1);
    } catch (assessmentError) {
      setError(assessmentError.message);
    } finally {
      setLoading(false);
    }
  };

  const requestQuote = async (shopName) => {
    setError("");
    try {
      await saveQuoteRequest({
        shopName,
        customer: user?.name || "Cliente de RepairScout",
        vehicle: `${vehicle.year} ${vehicle.make} ${vehicle.model}`.trim(),
        issue: description,
        zip,
        estimate: `$${estimatedTotal.low}–$${estimatedTotal.high}`,
        diagnosisSummary: diagnosis?.summary,
      });
      setRequestedShops((current) =>
        current.includes(shopName) ? current : [...current, shopName],
      );
    } catch (quoteError) {
      setError(quoteError.message);
    }
  };

  const findShops = async () => {
    setStep(3);
    setShopsLoading(true);
    setError("");
    try {
      const numericRadius = Number.parseInt(radius, 10) || 25;
      const result = await searchShops(zip, numericRadius);
      setAvailableShops(result.shops);
      setShopSource(result.source);
    } catch (shopError) {
      setError(shopError.message);
      setAvailableShops(demoShops);
      setShopSource("fallback");
    } finally {
      setShopsLoading(false);
    }
  };

  const persistVehicle = async () => {
    if (!user) {
      onRequireAuth();
      return;
    }
    setError("");
    try {
      await saveVehicle({ ...vehicle, vin, mileage });
      setVehicleSaved(true);
    } catch (saveError) {
      setError(saveError.message);
    }
  };

  return (
    <main>
      <section className="customer-hero">
        <div className="hero-copy">
          <div className="eyebrow"><Sparkles size={15} /> Orientación de reparación con IA</div>
          <h1>Conoce el problema.<br /><em>Conoce un precio justo.</em></h1>
          <p>Describe el problema, compara costos reales de piezas y mano de obra, y conéctate con un taller local de confianza.</p>
          <div className="trust-row">
            <span><ShieldCheck size={18} /> Sin precios sorpresa</span>
            <span><BadgeCheck size={18} /> Talleres verificados</span>
            <span><PackageSearch size={18} /> Búsqueda de piezas</span>
          </div>
        </div>

        <div className="intake-card">
          <div className="intake-head">
            <div>
              <span className="step-label">PASO 1 DE 4</span>
              <h2>Cuéntanos qué está pasando</h2>
            </div>
            <span className="ai-orb"><Bot size={23} /></span>
          </div>
          <label htmlFor="vin">VIN del vehículo</label>
          <div className="vin-row">
            <input id="vin" maxLength="17" value={vin} onChange={(event) => setVin(event.target.value.toUpperCase())} placeholder="17 caracteres" />
            <button className="outline" onClick={lookupVin} disabled={vinLoading || vin.length !== 17}>
              {vinLoading ? "Buscando..." : "Buscar VIN"}
            </button>
          </div>
          <div className="vehicle-field">
            <span className="vehicle-icon"><Car size={21} /></span>
            <span>
              <strong>{vehicle.make} {vehicle.model} {vehicle.year}</strong>
              <small>{[vehicle.trim, vehicle.engine].filter(Boolean).join(" · ")} · {mileage} millas</small>
            </span>
            <BadgeCheck size={18} />
          </div>
          <button className="save-vehicle" onClick={persistVehicle}>
            {vehicleSaved ? <><Check size={14} /> Vehículo guardado</> : "Guardar vehículo en mi cuenta"}
          </button>
          <label htmlFor="mileage">Millaje aproximado</label>
          <input className="plain-input" id="mileage" value={mileage} onChange={(event) => setMileage(event.target.value)} />
          <label htmlFor="description">Describe el problema</label>
          <textarea id="description" value={description} onChange={(event) => setDescription(event.target.value)} />
          <div className="quick-symptoms">
            {["Luz de advertencia", "Ruido extraño", "No enciende"].map((symptom) => (
              <button key={symptom} onClick={() => setDescription(`${description} ${symptom}.`.trim())}>{symptom}</button>
            ))}
          </div>
          <div className="location-grid">
            <div>
              <label htmlFor="zip">Código postal</label>
              <div className="input-icon"><MapPin size={17} /><input id="zip" value={zip} onChange={(event) => setZip(event.target.value)} /></div>
            </div>
            <div>
              <label htmlFor="radius">Radio de búsqueda</label>
              <select id="radius" value={radius} onChange={(event) => setRadius(event.target.value)}>
                <option>10 millas</option><option>25 millas</option><option>50 millas</option><option>100 millas</option>
              </select>
            </div>
          </div>
          {error ? <p className="form-error">{error}</p> : null}
          <button className="primary full" onClick={runAssessment} disabled={loading}>
            {loading ? "Analizando el problema..." : "Iniciar evaluación con IA"} <ArrowRight size={18} />
          </button>
          <p className="medical-note">Esta orientación es preliminar. Se requiere una inspección física para confirmar la reparación.</p>
        </div>
      </section>

      <div className="progress-strip">
        {steps.map((label, index) => (
          <button className={index <= step ? "done" : ""} key={label} onClick={() => index <= step && setStep(index)}>
            <span>{index < step ? <Check size={14} /> : index + 1}</span>{label}
          </button>
        ))}
      </div>

      {step === 0 ? (
        <section className="landing-story">
          <div className="landing-story-head">
            <span className="eyebrow dark"><Sparkles size={15} /> Una plataforma, dos lados</span>
            <h2>Del síntoma a una cotización clara</h2>
            <p>RepairScout conecta la investigación del conductor con la verificación profesional del taller.</p>
          </div>
          <div className="landing-feature-grid">
            <article>
              <span>01</span>
              <Bot size={24} />
              <h3>Describe el problema</h3>
              <p>Explica síntomas, agrega el VIN y recibe posibles causas con advertencias de seguridad.</p>
            </article>
            <article>
              <span>02</span>
              <PackageSearch size={24} />
              <h3>Compara el costo</h3>
              <p>Consulta rangos de piezas y mano de obra antes de autorizar una reparación.</p>
            </article>
            <article>
              <span>03</span>
              <Building2 size={24} />
              <h3>Confirma con un taller</h3>
              <p>Envía el caso a talleres cercanos para recibir evidencia y una cotización final.</p>
            </article>
          </div>
          <div className="audience-grid">
            <article>
              <small>PARA CONDUCTORES</small>
              <h3>Más claridad antes de gastar</h3>
              <p>Guarda vehículos, diagnósticos y cotizaciones en una sola cuenta.</p>
              <button className="primary" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>Comenzar evaluación <ArrowRight size={17} /></button>
            </article>
            <article>
              <small>PARA TALLERES</small>
              <h3>Mejores clientes, mejor contexto</h3>
              <p>Recibe solicitudes organizadas y convierte hallazgos técnicos en explicaciones claras.</p>
              <button className="outline" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>Explorar RepairScout <Wrench size={17} /></button>
            </article>
          </div>
        </section>
      ) : null}

      {step >= 1 ? (
        <section className="results-section">
          <div className="section-heading split">
            <div>
              <span className="eyebrow dark"><Gauge size={15} /> Evaluación preliminar</span>
              <h2>Esto es lo que podría estar pasando</h2>
              <p>Según tu vehículo, kilometraje y descripción. Estas posibilidades deben verificarse con pruebas.</p>
            </div>
            <div className="safety-alert"><ShieldCheck size={21} /><span><strong>Aviso de seguridad</strong>{diagnosis?.safetyMessage || "Limita el uso del vehículo hasta inspeccionar los frenos."}</span></div>
          </div>

          <div className="diagnosis-layout">
            <div className="diagnosis-list">
              {displayedCauses.map((result, index) => (
                <article className={`diagnosis-card ${index === 0 ? "featured" : ""}`} key={result.title}>
                  <div className={`probability ${result.tone}`}><strong>{result.probability}%</strong><span>probabilidad</span></div>
                  <div className="diagnosis-copy">
                    <div className="title-line"><h3>{result.title}</h3><span className={`status ${result.tone}`}>{result.urgency}</span></div>
                    <p>{result.reason}</p>
                    <small><Search size={14} /> Verificar: {result.test}</small>
                  </div>
                </article>
              ))}
            </div>

            <aside className="estimate-card">
              <span className="eyebrow dark"><CircleDollarSign size={15} /> Rango estimado de reparación</span>
              <div className="big-price">${estimatedTotal.low}–${estimatedTotal.high}</div>
              <p>{diagnosis?.estimate?.repairLabel || "Reemplazo de pastillas de freno delanteras, confirmando el estado de los rotores durante la inspección."}</p>
              <div className="cost-row"><span>Piezas</span><strong>${diagnosis?.estimate?.partsLow ?? 40}–${diagnosis?.estimate?.partsHigh ?? 146}</strong></div>
              <div className="cost-row"><span>Mano de obra · {diagnosis?.estimate?.laborHoursLow ?? 1.2}–{diagnosis?.estimate?.laborHoursHigh ?? 1.8} h</span><strong>${diagnosis?.estimate?.laborLow ?? 174}–${diagnosis?.estimate?.laborHigh ?? 261}</strong></div>
              <div className="cost-row"><span>Materiales e impuestos</span><strong>$25–$58</strong></div>
              <div className="confidence"><span>Confianza de la estimación</span><strong>{diagnosis?.estimate?.confidence || "Alta"}</strong><div><i /></div></div>
              <small className="source-note">{["openai", "ai-gateway"].includes(diagnosis?.source) ? "Evaluación generada con IA" : "Evaluación de respaldo basada en reglas"}</small>
              <button className="primary full" onClick={() => setStep(2)}>Comparar piezas y mano de obra <ArrowRight size={17} /></button>
            </aside>
          </div>
        </section>
      ) : null}

      {step >= 2 ? (
        <section className="results-section soft">
          <div className="section-heading split">
            <div>
              <span className="eyebrow dark"><PackageSearch size={15} /> Búsqueda de piezas</span>
              <h2>Compara piezas cerca de {zip}</h2>
              <p>Opciones de recogida local y en línea dentro del radio seleccionado de {radius}.</p>
            </div>
            <button className="outline" onClick={findShops}>Buscar talleres reales <MapPin size={17} /></button>
          </div>
          <div className="parts-table">
            <div className="table-head"><span>Vendedor y pieza</span><span>Disponibilidad</span><span>Garantía</span><span>Precio</span></div>
            {partsResults.map((part) => (
              <div className="part-row" key={part.seller}>
                <div className="seller-cell"><span className="seller-icon"><Store size={20} /></span><span><strong>{part.seller}</strong><small>{part.part}</small><i>{part.badge}</i></span></div>
                <div><strong>{part.availability}</strong><small>{part.distance}</small></div>
                <div><strong>{part.warranty}</strong><small>Consulta los términos</small></div>
                <div className="part-price">${part.price.toFixed(2)}<button>Ver</button></div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {step >= 3 ? (
        <section className="results-section">
          <div className="section-heading">
            <span className="eyebrow dark"><Building2 size={15} /> Talleres locales verificados</span>
            <h2>Confirma el diagnóstico</h2>
            <p>{shopsLoading ? "Buscando talleres cercanos..." : `Resultados de ${shopSource === "openstreetmap" ? "OpenStreetMap" : "RepairScout"}. Confirma disponibilidad directamente con el taller.`}</p>
          </div>
          <div className="shop-grid">
            {availableShops.map((shop) => {
              const requested = requestedShops.includes(shop.name);
              return (
                <article className="shop-card" key={shop.name}>
                  <div className="shop-card-top"><span className="shop-logo">{shop.name.slice(0, 1)}</span><div><h3>{shop.name} {shop.verified ? <BadgeCheck size={17} /> : null}</h3><p>{shop.rating ? <><Star size={14} fill="currentColor" /> {shop.rating} ({shop.reviews}) · </> : null}{shop.distance}</p></div></div>
                  <p className="specialty">{shop.specialty}</p>
                  <div className="shop-detail"><Clock3 size={16} /><span>Próxima cita<strong>{shop.availability}</strong></span></div>
                  <div className="shop-detail"><CircleDollarSign size={16} /><span>Rango preliminar<strong>{shop.estimate}</strong></span></div>
                  <button className={requested ? "requested full" : "primary full"} onClick={() => requestQuote(shop.name)}>
                    {requested ? <><Check size={17} /> Cotización solicitada</> : <>Solicitar cotización verificada <ChevronRight size={17} /></>}
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}
    </main>
  );
}

function Sidebar({ active, setActive }) {
  const links = [
    ["Resumen", LayoutDashboard],
    ["Solicitudes", MessageSquareText],
    ["Citas", Calendar],
    ["Órdenes de trabajo", Wrench],
    ["Clientes", Users],
    ["Búsqueda de piezas", PackageSearch],
  ];

  return (
    <aside className="shop-sidebar">
      <Brand />
      <div className="shop-identity"><span>MS</span><div><strong>Mason Street Auto</strong><small>Administrador del taller</small></div><ChevronDown size={16} /></div>
      <nav>
        {links.map(([label, Icon]) => (
          <button className={active === label ? "active" : ""} onClick={() => setActive(label)} key={label}><Icon size={18} />{label}{label === "Solicitudes" ? <i>3</i> : null}</button>
        ))}
      </nav>
      <div className="sidebar-promo"><Bot size={25} /><strong>Asesor de servicio con IA</strong><p>Prepara estimaciones y explica reparaciones en segundos.</p><button>Preguntar a Scout</button></div>
      <small className="sidebar-foot">Taller RepairScout · Vista previa</small>
    </aside>
  );
}

function ShopPortal({ user }) {
  const [active, setActive] = useState("Resumen");
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [savedRequests, setSavedRequests] = useState([]);

  useEffect(() => {
    let cancelled = false;

    getQuoteRequests()
      .then(({ quoteRequests: requests }) => {
        if (!cancelled) setSavedRequests(requests);
      })
      .catch(() => {
        if (!cancelled) setSavedRequests([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const visibleRequests = useMemo(() => {
    const live = savedRequests.map((request) => ({
      ...request,
      value: request.estimate,
      distance: request.zip,
      time: new Date(request.createdAt).toLocaleString("es-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
    }));
    return [...live, ...quoteRequests];
  }, [savedRequests]);

  return (
    <main className="shop-shell">
      <Sidebar active={active} setActive={setActive} />
      <div className="shop-main">
        <header className="shop-header">
          <div><span className="breadcrumb">Portal del taller / {active}</span><h1>{active === "Resumen" ? "Buenos días, Alex" : active}</h1></div>
          <div className="shop-header-actions"><button className="icon-button"><Search size={19} /></button><button className="icon-button"><Bell size={19} /><i /></button><span className="avatar">AS</span></div>
        </header>

        <div className="shop-content">
          <section className="metric-grid">
            <article><span className="metric-icon green"><MessageSquareText /></span><div><small>Nuevas solicitudes</small><strong>{visibleRequests.length}</strong><em>{savedRequests.length} recibidas en la app</em></div></article>
            <article><span className="metric-icon blue"><Calendar /></span><div><small>Citas de hoy</small><strong>7</strong><em>Primera a las 8:30 a. m.</em></div></article>
            <article><span className="metric-icon amber"><Wrench /></span><div><small>Órdenes abiertas</small><strong>5</strong><em>3 en proceso</em></div></article>
            <article><span className="metric-icon purple"><CircleDollarSign /></span><div><small>Cotizado esta semana</small><strong>$8,940</strong><em className="positive">↑ 12.4%</em></div></article>
          </section>

          <section className="shop-columns">
            <div className="panel requests-panel">
              <div className="panel-title"><div><h2>Solicitudes de cotización</h2><p>Clientes cercanos que buscan ayuda</p></div><button onClick={() => setActive("Solicitudes")}>Ver todas</button></div>
              <div className="request-list">
                {visibleRequests.map((request) => (
                  <button className="request-row" key={request.id || `${request.customer}-${request.vehicle}`} onClick={() => setSelectedRequest(request)}>
                    <span className="request-avatar">{request.initials}</span>
                    <span className="request-main"><span><strong>{request.customer}</strong><i className={request.status === "Cotizada" ? "quoted" : ""}>{request.status}</i></span><b>{request.vehicle}</b><small>{request.issue}</small></span>
                    <span className="request-meta"><strong>{request.value}</strong><small>{request.distance} · {request.time}</small><ChevronRight size={17} /></span>
                  </button>
                ))}
              </div>
            </div>

            <div className="panel schedule-panel">
              <div className="panel-title"><div><h2>Agenda de hoy</h2><p>Sábado, 20 de junio</p></div><button><Calendar size={17} /></button></div>
              <div className="timeline">
                <div><time>8:30</time><span className="timeline-dot active" /><article><strong>Cambio de aceite e inspección</strong><p>Taylor Kim · Subaru Outback 2020</p><i>En proceso</i></article></div>
                <div><time>10:00</time><span className="timeline-dot" /><article><strong>Diagnóstico de frenos</strong><p>Marcus Hill · Chevrolet Malibu 2018</p><i className="scheduled">Confirmada</i></article></div>
                <div><time>11:30</time><span className="timeline-dot" /><article><strong>El aire acondicionado no enfría</strong><p>Ana Cruz · Honda Civic 2016</p><i className="scheduled">Confirmada</i></article></div>
                <div><time>1:00</time><span className="timeline-dot empty" /><article className="open-slot"><strong>Cita disponible</strong><button>Reservar</button></article></div>
              </div>
            </div>
          </section>

          <section className="shop-bottom-grid">
            <article className="ai-workbench">
              <span className="ai-large"><Bot /></span>
              <div><span className="eyebrow"><Sparkles size={14} /> Centro de diagnóstico con IA</span><h2>Convierte síntomas en un plan de pruebas</h2><p>Ingresa el problema del cliente o un código DTC. Scout organizará causas probables, pasos de verificación, piezas y mano de obra.</p></div>
              <button>Iniciar diagnóstico <ArrowRight size={17} /></button>
            </article>
            <article className="conversion-card">
              <div className="panel-title"><div><h2>Rendimiento de cotizaciones</h2><p>Últimos 30 días</p></div></div>
              <div className="conversion-stat"><strong>68%</strong><span>tasa de aprobación<em>↑ 8%</em></span></div>
              <div className="bar"><i /></div>
              <div className="mini-stats"><span><strong>42</strong>Enviadas</span><span><strong>29</strong>Aprobadas</span><span><strong>$412</strong>Promedio</span></div>
            </article>
          </section>
        </div>
      </div>

      {selectedRequest ? (
        <div className="modal-backdrop" onClick={() => setSelectedRequest(null)}>
          <section className="quote-drawer" onClick={(event) => event.stopPropagation()}>
            <button className="drawer-close" onClick={() => setSelectedRequest(null)}><X /></button>
            <span className="eyebrow dark"><FileCheck2 size={15} /> Solicitud de cotización</span>
            <h2>{selectedRequest.vehicle}</h2>
            <p className="drawer-customer">{selectedRequest.customer} · {selectedRequest.distance}</p>
            <div className="concern-box"><small>PROBLEMA DEL CLIENTE</small><strong>{selectedRequest.issue}</strong><p>La información recopilada por IA está lista para revisión. Confirma los hallazgos antes de emitir el diagnóstico final.</p></div>
            <h3>Punto de partida sugerido por la IA</h3>
            <div className="drawer-check"><Check size={16} /><span><strong>Inspeccionar el sistema reportado</strong>Revisar los síntomas y escanear el vehículo en busca de códigos relacionados.</span></div>
            <div className="drawer-check"><Check size={16} /><span><strong>Verificar antes de reemplazar piezas</strong>Adjuntar mediciones, fotografías o resultados de pruebas.</span></div>
            <div className="draft-total"><span>Rango preliminar del cliente</span><strong>{selectedRequest.value}</strong></div>
            <button className="primary full">Abrir centro de diagnóstico <ArrowRight size={17} /></button>
            <button className="outline full">Enviar mensaje al cliente</button>
          </section>
        </div>
      ) : null}
    </main>
  );
}

export default function App() {
  const [portal, setPortal] = useState("customer");
  const [user, setUser] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    if (!window.localStorage.getItem("repairscout_token")) return;
    getCurrentUser()
      .then(({ user: currentUser }) => setUser(currentUser))
      .catch(() => window.localStorage.removeItem("repairscout_token"));
  }, []);

  const logout = () => {
    window.localStorage.removeItem("repairscout_token");
    setUser(null);
    setPortal("customer");
  };

  return (
    <>
      {portal === "customer" ? <TopBar portal={portal} setPortal={setPortal} user={user} onAuth={() => setAuthOpen(true)} onLogout={logout} /> : null}
      {portal === "customer" ? <CustomerPortal user={user} onRequireAuth={() => setAuthOpen(true)} /> : <ShopPortal user={user} />}
      {authOpen ? <AuthModal onClose={() => setAuthOpen(false)} onAuthenticated={setUser} /> : null}
    </>
  );
}
