import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export const Private = () => {
  const navigate = useNavigate();
  const raw = import.meta.env.VITE_BACKEND_URL;
  const backendUrl = raw?.replace(/\/+$/, "") || "";  // ⬅️ quita trailing slashes
  const [greeting, setGreeting] = useState("");

  useEffect(() => {
    const token = sessionStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    (async () => {
      try {
        const res = await fetch(`${backendUrl}/api/private`, {
          headers: { Authorization: `Bearer ${token}` }
        });


        if (res.status === 401) {
          sessionStorage.removeItem("token");
          navigate("/login");
          return;
        }
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || "Unauthorized");
        setGreeting(data.msg);
      } catch {
        sessionStorage.removeItem("token");
        navigate("/login");
      }
    })();
  }, [backendUrl, navigate]);

  return (
    <div className="container mt-4">
      <h2>Private area</h2>
      <div className="alert alert-success mt-3">
        {greeting || "Validating access..."}
      </div>
      <p className="text-muted">Only authenticated users can see this.</p>
    </div>
  );
};
