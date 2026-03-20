import { Link } from "react-router-dom";

export default function Sidebar() {
  const menu = [
    { name: "Dashboard", path: "/" },
    { name: "Opportunity Intake", path: "/intake" },
    { name: "Capital Stack", path: "/capital" },
    { name: "SPV Registry", path: "/spv" },
    { name: "Waterfalls", path: "/waterfalls" },
    { name: "HoldCo Summary", path: "/holdco" },
    { name: "Documents", path: "/documents" },
    { name: "Notifications", path: "/notifications" },
  ];

  return (
    <div style={{
      width: "260px",
      background: "#020617",
      padding: "20px",
      borderRight: "1px solid #1e293b"
    }}>
      
      <h2 style={{ color: "#f97316", marginBottom: "20px" }}>
        UBUYBOX
      </h2>

      {menu.map((item) => (
        <div key={item.path} style={{ margin: "12px 0" }}>
          <Link
            to={item.path}
            style={{
              color: "#cbd5f5",
              textDecoration: "none",
              fontSize: "14px"
            }}
          >
            {item.name}
          </Link>
        </div>
      ))}

    </div>
  );
}