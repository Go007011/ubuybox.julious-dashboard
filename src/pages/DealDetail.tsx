import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getDealById } from "../api/localDeals";
import { getDocumentsByDealId } from "../api/documents";

export default function DealDetail() {
  const { id } = useParams();
  const [deal, setDeal] = useState<any>(null);
  const [docs, setDocs] = useState<any>(null);

 useEffect(() => {
  if (!id) return;

  const found = getDealById(id); // KEEP ORIGINAL
  const cleanId = id.replace("Deal_", "");
  const foundDocs = getDocumentsByDealId(cleanId);

  setDeal(found);
  setDocs(foundDocs);
}, [id]);;

  if (!deal) {
    return <div>Loading...</div>;
  }

  const total = deal.senior + deal.mezz + deal.equity;

  return (
    <div>
      <h1>{deal.deal}</h1>

      <p>{deal.spv}</p>
      <p>{deal.location}</p>

      <h3>Purchase: ${deal.price.toLocaleString()}</h3>
      <p>Total Capital: ${total.toLocaleString()}</p>

      <div style={{ marginTop: "20px" }}>
        <p>Senior: ${deal.senior.toLocaleString()}</p>
        <p>Mezz: ${deal.mezz.toLocaleString()}</p>
        <p>Equity: ${deal.equity.toLocaleString()}</p>
      </div>

      <p style={{ marginTop: "20px" }}>
        Monthly Payment: ${deal.payment.toLocaleString()}
      </p>

      <div style={{ marginTop: "40px" }}>
        <h2>Documents</h2>

        {!docs || !docs.docs || docs.docs.length === 0 ? (
          <p>No documents available</p>
        ) : (
          <div style={{ display: "grid", gap: "12px", marginTop: "16px" }}>
            {docs.docs.map((doc: any, i: number) => (
              <a
                key={i}
                href={doc.url}
                target="_blank"
                rel="noreferrer"
                style={{
                  padding: "14px 18px",
                  borderRadius: "10px",
                  background: "#0b1a33",
                  border: "1px solid #1f3a5f",
                  color: "white",
                  textDecoration: "none",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span>{doc.name}</span>
                <span style={{ opacity: 0.6 }}>{doc.type}</span>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}