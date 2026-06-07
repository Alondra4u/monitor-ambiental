import { NavLink } from "react-router-dom";

const linkBaseClasses = "cursor-pointer hover:text-gray-200";
const activeClasses = "font-semibold underline";

export default function Navbar() {
  return (
    <nav className="bg-[#0982A0] text-white py-4 px-8 shadow-md">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <h1 className="text-xl font-semibold">
          Estación de Monitoreo de Calidad del Aire
        </h1>

        <ul className="flex gap-8 text-sm">
          <li>
            <NavLink
              to="/"
              className={({ isActive }) =>
                `${linkBaseClasses} ${isActive ? activeClasses : ""}`
              }
              end
            >
              Dashboard
            </NavLink>
          </li>

          <li>
            <NavLink
              to="/historial"
              className={({ isActive }) =>
                `${linkBaseClasses} ${isActive ? activeClasses : ""}`
              }
            >
              Historial
            </NavLink>
          </li>

          <li>
            <NavLink
              to="/comparativa"
              className={({ isActive }) =>
                `${linkBaseClasses} ${isActive ? activeClasses : ""}`
              }
            >
              Comparativa
            </NavLink>
          </li>

          <li>
            <NavLink
              to="/alarmas"
              className={({ isActive }) =>
                `${linkBaseClasses} ${isActive ? activeClasses : ""}`
              }
            >
              Alarmas
            </NavLink>
          </li>
        </ul>
      </div>
    </nav>
  );
}
