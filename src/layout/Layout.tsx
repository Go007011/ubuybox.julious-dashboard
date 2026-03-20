import Sidebar from "./Sidebar";

export default function Layout({ children }: any) {
  return (
    <div style={{ display: "flex", height: "100vh", background: "#0f172a" }}>
      
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div style={{
        flex: 1,
        padding: "30px",
        color: "white"
      }}>
        {children}
      </div>

    </div>
  );
}