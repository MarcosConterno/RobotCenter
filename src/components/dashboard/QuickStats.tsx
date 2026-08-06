export default function QuickStats() {
  const stats = [
    {
      titulo: "Robôs",
      valor: "18",
    },
    {
      titulo: "Em Produção",
      valor: "12",
    },
    {
      titulo: "Homologação",
      valor: "4",
    },
    {
      titulo: "Desenvolvimento",
      valor: "2",
    },
  ];

  return (
    <aside
      style={{
        width: "320px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      {stats.map((item) => (
        <div
          key={item.titulo}
          style={{
            background: "#1E293B",
            border: "1px solid #273449",
            borderRadius: "12px",
            padding: "20px",
          }}
        >
          <div
            style={{
              color: "#94A3B8",
              fontSize: "14px",
            }}
          >
            {item.titulo}
          </div>

          <div
            style={{
              marginTop: "8px",
              color: "#F8FAFC",
              fontSize: "32px",
              fontWeight: 700,
            }}
          >
            {item.valor}
          </div>
        </div>
      ))}
    </aside>
  );
}