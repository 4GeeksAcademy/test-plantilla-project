import { Link, useNavigate } from "react-router-dom";
import useGlobalReducer from "../hooks/useGlobalReducer";

export const Navbar = () => {
  const { store, dispatch } = useGlobalReducer();
  const navigate = useNavigate();

  const handleLogout = () => {
    dispatch({ type: "logout" });
    navigate("/login");
  };

  return (
    <nav className="navbar navbar-light bg-light">
      <div className="container">
        <Link to="/">
          <span className="navbar-brand mb-0 h1">React Boilerplate</span>
        </Link>
        <div className="ml-auto d-flex gap-2">
          {/* Botón de demo */}
          <Link to="/demo">
            <button className="btn btn-secondary">Context demo</button>
          </Link>

          {/* Si hay token, mostrar Agenda + Logout */}
          {store.token ? (
            <>
              <Link to="/agenda">
                <button className="btn btn-outline-primary">Agenda</button>
              </Link>
              <button className="btn btn-danger" onClick={handleLogout}>
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login">
                <button className="btn btn-primary">Login</button>
              </Link>
              <Link to="/signup">
                <button className="btn btn-outline-primary">Sign up</button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};
