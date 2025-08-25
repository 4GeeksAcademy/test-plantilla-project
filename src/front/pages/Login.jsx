import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import useGlobalReducer from "../hooks/useGlobalReducer";

export const Login = () => {
  const navigate = useNavigate();
  const { dispatch } = useGlobalReducer();

  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Normaliza la URL (sin trailing slash)
  const backendUrl = (import.meta.env.VITE_BACKEND_URL || "").replace(/\/+$/, "");

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!backendUrl) throw new Error("Falta VITE_BACKEND_URL en .env");

      const res = await fetch(`${backendUrl}/api/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Login failed");

      // Guarda token y redirige a la agenda
      dispatch({ type: "login_success", payload: { token: data.access_token } });
      navigate("/agenda", { replace: true });
    } catch (err) {
      setError(err.message || "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mt-4" style={{ maxWidth: 480 }}>
      <h2>Login</h2>

      <form onSubmit={handleSubmit} className="mt-3">
        <div className="mb-3">
          <label className="form-label">Email</label>
          <input
            name="email"
            type="email"
            className="form-control"
            value={form.email}
            onChange={handleChange}
            required
            autoFocus
          />
        </div>

        <div className="mb-3">
          <label className="form-label">Password</label>
          <input
            name="password"
            type="password"
            className="form-control"
            value={form.password}
            onChange={handleChange}
            required
          />
        </div>

        {error && <div className="alert alert-danger">{error}</div>}

        <button className="btn btn-primary w-100" type="submit" disabled={loading}>
          {loading ? "Ingresando..." : "Log in"}
        </button>
      </form>

      <p className="mt-3">
        ¿Nuevo aquí? <Link to="/signup">Crear cuenta</Link>
      </p>
    </div>
  );
};
