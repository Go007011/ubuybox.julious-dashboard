import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom"; // ✅ REQUIRED

export default function CapitalStack() {
  const [deals, setDeals] = useState<any[]>([]);
  const navigate = useNavigate(); // ✅ REQUIRED

  useEffect(() => {
    setDeals([
      {
        deal: "Deal_017",
        spv: "SPV_017",
        location: "Bexar County, TX",
        price: 495000,
        senior: 465300,
        mezz: 20000,
        equity: 29700,
        payment: 1292,
        status: "Green",
      },
      {
        deal: "Deal_021",
        spv: "SPV_021",
        location: "Atlanta, GA",
        price: 720000,
        senior: 650000,
        mezz: 40000,
        equity: 30000,
        payment: 2100,
        status: "Red",
      },
    ]);
  }, []);

  return (
    <div>
      <h1 style={{ marginBottom: "20px" }}>Capital Stack</h1>

      <div style={{ display: "grid", gap: "20px" }}>
        {deals.map((d, i) => {
          const total = d.senior + d.mezz + d.equity;

          const seniorPct = (d.senior / total) * 100;
          const mezzPct = (d.mezz / total) * 100;
          const equityPct = (d.equity / total) * 100;

          return (
            <div
              key={i}
              style={{
                position: "relative",
                background: "#020617",
                border: "1px solid #1e293b",
                borderRadius: "16px",
                padding: "20px",
              }}
            >
              {/* HEADER */}
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div>
                  <h2>{d.deal}</h2>

                  <p style={{ color: "#64748b" }}>
                    {d.spv} • Seller Carryback Structure
                  </p>

                  <p style={{ color: "#94a3b8" }}>{d.location}</p>
                </div>

                <div
                  style={{
                    background:
                      d.status === "Green"
                        ? "#16a34a"
                        : d.status === "Yellow"
                        ? "#ca8a04"
                        : "#dc2626",
                    padding: "6px 12px",
                    borderRadius: "8px",
                    color: "white",
                    fontSize: "12px",
                  }}
                >
                  {d.status}
                </div>
              </div>

              {/* PRICE */}
              <h3 style={{ marginTop: "15px" }}>
                Purchase: ${d.price.toLocaleString()}
              </h3>

              {/* TOTAL */}
              <div style={{ color: "#94a3b8", marginTop: "5px" }}>
                Total Capital: ${total.toLocaleString()}
              </div>

              {/* TRANCHES */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: "10px",
                  marginTop: "15px",
                }}
              >
                <div style={box("#1d4ed8")}>
                  <p>Senior</p>
                  <strong>${d.senior.toLocaleString()}</strong>
                </div>

                <div style={box("#9333ea")}>
                  <p>Mezz</p>
                  <strong>${d.mezz.toLocaleString()}</strong>
                </div>

                <div style={box("#f97316")}>
                  <p>Equity</p>
                  <strong>${d.equity.toLocaleString()}</strong>
                </div>
              </div>

              {/* STACK BAR */}
              <div
                style={{
                  display: "flex",
                  height: "10px",
                  marginTop: "15px",
                  borderRadius: "6px",
                  overflow: "hidden",
                }}
              >
                <div style={{ width: `${seniorPct}%`, background: "#1d4ed8" }} />
                <div style={{ width: `${mezzPct}%`, background: "#9333ea" }} />
                <div style={{ width: `${equityPct}%`, background: "#f97316" }} />
              </div>

              {/* PAYMENT + BUTTON */}
              <div
                style={{
                  marginTop: "15px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ color: "#cbd5f5" }}>
                  Monthly Payment: ${d.payment.toLocaleString()}/mo
                </span>

                <button
                  disabled={d.status === "Red"}
                  onClick={() =>
                    navigate(`/deal/${d.deal}`, { state: d })
                  }
                  style={{
                    background:
                      d.status === "Red" ? "#475569" : "#f97316",
                    color: "white",
                    border: "none",
                    padding: "10px 16px",
                    borderRadius: "8px",
                    cursor:
                      d.status === "Red" ? "not-allowed" : "pointer",
                  }}
                >
                  {d.status === "Red" ? "Locked" : "Enter Deal"}
                </button>
              </div>

              {/* LOCK OVERLAY */}
              {d.status === "Red" && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "rgba(2,6,23,0.65)",
                    borderRadius: "16px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: "bold",
                    color: "#cbd5f5",
                  }}
                >
                  🔒 Deal Locked
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function box(color: string) {
  return {
    border: `1px solid ${color}`,
    borderRadius: "10px",
    padding: "10px",
  };
}