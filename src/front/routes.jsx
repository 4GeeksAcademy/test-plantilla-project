import {
  createBrowserRouter,
  createRoutesFromElements,
  Route,
} from "react-router-dom";

import { Layout } from "./pages/Layout";
import { Home } from "./pages/Home";
import { Single } from "./pages/Single";
import { Demo } from "./pages/Demo";
import { Signup } from "./pages/Signup";
import { Login } from "./pages/Login";
import { Private } from "./pages/Private";      // (opcional, puedes quitarlo si ya no lo usas)
import Agenda from "./pages/Agenda";            // ⬅️ NUEVO
import ProtectedRoute from "./components/ProtectedRoute"; // ⬅️ NUEVO

export const router = createBrowserRouter(
  createRoutesFromElements(
    <Route path="/" element={<Layout />} errorElement={<h1>Not found!</h1>}>
      <Route index element={<Home />} />
      <Route path="single/:theId" element={<Single />} />
      <Route path="demo" element={<Demo />} />

      {/* Auth */}
      <Route path="signup" element={<Signup />} />
      <Route path="login" element={<Login />} />

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
