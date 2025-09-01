import {
  createBrowserRouter,
  createRoutesFromElements,
  Route,
  Navigate
} from "react-router-dom";

import { Layout } from "./pages/Layout";
import { Home } from "./pages/Home";
import { Single } from "./pages/Single";
import { Demo } from "./pages/Demo";
import { Signup } from "./pages/Signup";
import { Login } from "./pages/Login";
import { Private } from "./pages/Private";
import Agenda from "./pages/Agenda";
import ProtectedRoute from "./components/ProtectedRoute";

// Redirección inteligente en la raíz
function RedirectRoot() {
  const token = sessionStorage.getItem("token");
  return <Navigate to={token ? "/agenda" : "/login"} replace />;
}

export const router = createBrowserRouter(
  createRoutesFromElements(
    <Route path="/" element={<Layout />} errorElement={<h1>Not found!</h1>}>
      {/* Al entrar en '/', decidir a dónde ir */}
      <Route index element={<RedirectRoot />} />

      {/* Páginas públicas */}
      <Route path="login" element={<Login />} />
      <Route path="signup" element={<Signup />} />

      {/* Demo / ejemplos (públicos) */}
      <Route path="single/:theId" element={<Single />} />
      <Route path="demo" element={<Demo />} />
      <Route path="home" element={<Home />} />

      {/* Ruta privada clásica (opcional) */}
      <Route
        path="private"
        element={
          <ProtectedRoute>
            <Private />
          </ProtectedRoute>
        }
      />

      {/* Agenda protegida */}
      <Route
        path="agenda"
        element={
          <ProtectedRoute>
            <Agenda />
          </ProtectedRoute>
        }
      />
    </Route>
  )
);
