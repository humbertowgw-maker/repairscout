import React, { useState } from "react";
import { Search, ShieldCheck, Sparkles } from "lucide-react";
import { searchConfirmedFixes } from "./api";
import { T } from "./i18n";

// Standalone page, kept out of App.jsx (already ~4800 lines) — symptom +
// vehicle search over confirmed fixes other users reported, Identifix
// "Direct-Hit" style. Receives `lang`/`setPage` as props rather than using
// App.jsx's LangCtx/useT hooks directly, matching the existing pattern for
// extracted components like SendQuoteModal.
export default function ConfirmedFixSearchPage({ lang, setPage }) {
  const t = (key) => T[lang]?.[key] ?? T.es[key] ?? key;
  const isEn = lang === "en";

  const [form, setForm] = useState({ year: "", make: "", model: "", engine: "", symptom: "" });
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const runSearch = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.make.trim() || !form.model.trim() || form.symptom.trim().length < 3) {
      setError(t("searchValidationError"));
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const response = await searchConfirmedFixes(form);
      setResults(response.results || []);
    } catch (err) {
      setError(err.message);
      setResults(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main>
      <section className="customer-hero">
        <div className="hero-copy">
          <div className="eyebrow"><Search size={15} /> {t("searchNav")}</div>
          <h1>{t("searchPageTitle")}</h1>
          <p>{t("searchPageDesc")}</p>
        </div>

        <div className="intake-card">
          <form onSubmit={runSearch}>
            <label>{isEn ? "Vehicle" : "Vehículo"}</label>
            <div className="manual-vehicle-grid">
              {[
                ["year", t("vehicleYear"), "2019"],
                ["make", t("vehicleMake"), "Honda"],
                ["model", t("vehicleModel"), "Accord"],
                ["engine", `${t("vehicleEngine")} (${t("optionalLabel")})`, "1.5L Turbo"],
              ].map(([field, label, placeholder]) => (
                <label key={field} className={field === "engine" ? "wide" : ""}>
                  {label}
                  <input
                    value={form[field]}
                    onChange={(e) => updateField(field, e.target.value)}
                    placeholder={placeholder}
                  />
                </label>
              ))}
            </div>
            <label htmlFor="search-symptom">{t("searchSymptomLabel")}</label>
            <textarea
              id="search-symptom"
              className="plain-input"
              value={form.symptom}
              onChange={(e) => updateField("symptom", e.target.value)}
              placeholder={t("descLabel")}
            />
            {error && <p className="form-error">{error}</p>}
            <button className="primary" type="submit" disabled={loading}>
              {loading ? t("recallsLoading") : t("searchBtn")}
            </button>
          </form>
        </div>
      </section>

      {searched && !loading && (
        <section style={{ maxWidth: 720, margin: "0 auto", padding: "0 20px 60px" }}>
          {results && results.length > 0 ? (
            <>
              <p style={{ fontSize: 13, color: "#64748b", marginBottom: 12 }}>
                {t("searchResultsCount").replace("{count}", results.length)}
              </p>
              {results.map((r) => (
                <div
                  key={r.id}
                  style={{ background: "#0d1829", border: "1px solid #1e2d47", borderRadius: 12, padding: "16px 18px", marginBottom: 12 }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                    <strong style={{ color: "#f1f5f9", fontSize: 14 }}>{r.causeTitle}</strong>
                    <span
                      style={{
                        fontSize: 10, fontWeight: 700, letterSpacing: ".05em", padding: "3px 8px", borderRadius: 999,
                        background: r.trustTier === "admin_reviewed" ? "rgba(34,197,94,.15)" : "rgba(96,165,250,.15)",
                        color: r.trustTier === "admin_reviewed" ? "#4ade80" : "#60a5fa", whiteSpace: "nowrap",
                      }}
                    >
                      {r.trustTier === "admin_reviewed" ? t("searchTrustAdmin") : t("searchTrustShop")}
                    </span>
                  </div>
                  {r.fixDescription && <p style={{ color: "#cbd5e1", fontSize: 13, marginTop: 8 }}>{r.fixDescription}</p>}
                  <div style={{ display: "flex", gap: 14, marginTop: 10, fontSize: 12, color: "#94a3b8" }}>
                    <span>{[r.vehicle?.year, r.vehicle?.make, r.vehicle?.model].filter(Boolean).join(" ")}</span>
                    {r.costActual != null && <span>${r.costActual}</span>}
                  </div>
                </div>
              ))}
            </>
          ) : (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "#94a3b8" }}>
              <Sparkles size={28} style={{ marginBottom: 10 }} />
              <p>{t("searchEmptyState")}</p>
              <button className="outline" style={{ marginTop: 12 }} onClick={() => setPage("home")}>
                {isEn ? "Try AI diagnosis instead" : "Probar diagnóstico con IA"}
              </button>
            </div>
          )}
        </section>
      )}

      <section style={{ maxWidth: 720, margin: "0 auto", padding: "0 20px 40px", display: "flex", alignItems: "center", gap: 8, color: "#64748b", fontSize: 12 }}>
        <ShieldCheck size={14} />
        {isEn
          ? "Results are only fixes shops or admins confirmed actually worked — not raw self-reports."
          : "Los resultados son solo reparaciones que talleres o administradores confirmaron que funcionaron — no autoinformes sin verificar."}
      </section>
    </main>
  );
}
