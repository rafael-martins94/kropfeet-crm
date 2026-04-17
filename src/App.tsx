import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { AppLayout } from "./layouts/AppLayout";
import { ProtectedRoute, PublicOnlyRoute } from "./routes/ProtectedRoute";

import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import NotFoundPage from "./pages/NotFoundPage";

import MarcasListPage from "./pages/marcas/MarcasListPage";
import MarcaFormPage from "./pages/marcas/MarcaFormPage";
import MarcaDetailPage from "./pages/marcas/MarcaDetailPage";

import CategoriasListPage from "./pages/categorias/CategoriasListPage";
import CategoriaFormPage from "./pages/categorias/CategoriaFormPage";
import CategoriaDetailPage from "./pages/categorias/CategoriaDetailPage";

import FornecedoresListPage from "./pages/fornecedores/FornecedoresListPage";
import FornecedorFormPage from "./pages/fornecedores/FornecedorFormPage";
import FornecedorDetailPage from "./pages/fornecedores/FornecedorDetailPage";

import LocaisEstoqueListPage from "./pages/locais-estoque/LocaisEstoqueListPage";
import LocalEstoqueFormPage from "./pages/locais-estoque/LocalEstoqueFormPage";
import LocalEstoqueDetailPage from "./pages/locais-estoque/LocalEstoqueDetailPage";

import ModelosListPage from "./pages/modelos-produto/ModelosListPage";
import ModeloFormPage from "./pages/modelos-produto/ModeloFormPage";
import ModeloDetailPage from "./pages/modelos-produto/ModeloDetailPage";

import ItensEstoqueListPage from "./pages/itens-estoque/ItensEstoqueListPage";
import ItemEstoqueFormPage from "./pages/itens-estoque/ItemEstoqueFormPage";
import ItemEstoqueDetailPage from "./pages/itens-estoque/ItemEstoqueDetailPage";

import ClientesListPage from "./pages/clientes/ClientesListPage";
import ClienteFormPage from "./pages/clientes/ClienteFormPage";
import ClienteDetailPage from "./pages/clientes/ClienteDetailPage";

import VendasListPage from "./pages/vendas/VendasListPage";
import VendaFormPage from "./pages/vendas/VendaFormPage";
import VendaDetailPage from "./pages/vendas/VendaDetailPage";

import CambiosListPage from "./pages/cambios-moeda/CambiosListPage";
import MovimentacoesListPage from "./pages/movimentacoes/MovimentacoesListPage";
import LogsTinyListPage from "./pages/logs-tiny/LogsTinyListPage";
import ImagensListPage from "./pages/imagens/ImagensListPage";

import UsuariosListPage from "./pages/usuarios/UsuariosListPage";
import UsuarioFormPage from "./pages/usuarios/UsuarioFormPage";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />

            <Route path="/marcas" element={<MarcasListPage />} />
            <Route path="/marcas/novo" element={<MarcaFormPage />} />
            <Route path="/marcas/:id" element={<MarcaDetailPage />} />
            <Route path="/marcas/:id/editar" element={<MarcaFormPage />} />

            <Route path="/categorias" element={<CategoriasListPage />} />
            <Route path="/categorias/novo" element={<CategoriaFormPage />} />
            <Route path="/categorias/:id" element={<CategoriaDetailPage />} />
            <Route path="/categorias/:id/editar" element={<CategoriaFormPage />} />

            <Route path="/fornecedores" element={<FornecedoresListPage />} />
            <Route path="/fornecedores/novo" element={<FornecedorFormPage />} />
            <Route path="/fornecedores/:id" element={<FornecedorDetailPage />} />
            <Route path="/fornecedores/:id/editar" element={<FornecedorFormPage />} />

            <Route path="/locais-estoque" element={<LocaisEstoqueListPage />} />
            <Route path="/locais-estoque/novo" element={<LocalEstoqueFormPage />} />
            <Route path="/locais-estoque/:id" element={<LocalEstoqueDetailPage />} />
            <Route path="/locais-estoque/:id/editar" element={<LocalEstoqueFormPage />} />

            <Route path="/modelos-produto" element={<ModelosListPage />} />
            <Route path="/modelos-produto/novo" element={<ModeloFormPage />} />
            <Route path="/modelos-produto/:id" element={<ModeloDetailPage />} />
            <Route path="/modelos-produto/:id/editar" element={<ModeloFormPage />} />

            <Route path="/itens-estoque" element={<ItensEstoqueListPage />} />
            <Route path="/itens-estoque/novo" element={<ItemEstoqueFormPage />} />
            <Route path="/itens-estoque/:id" element={<ItemEstoqueDetailPage />} />
            <Route path="/itens-estoque/:id/editar" element={<ItemEstoqueFormPage />} />

            <Route path="/clientes" element={<ClientesListPage />} />
            <Route path="/clientes/novo" element={<ClienteFormPage />} />
            <Route path="/clientes/:id" element={<ClienteDetailPage />} />
            <Route path="/clientes/:id/editar" element={<ClienteFormPage />} />

            <Route path="/vendas" element={<VendasListPage />} />
            <Route path="/vendas/novo" element={<VendaFormPage />} />
            <Route path="/vendas/:id" element={<VendaDetailPage />} />
            <Route path="/vendas/:id/editar" element={<VendaFormPage />} />

            <Route path="/cambios-moeda" element={<CambiosListPage />} />
            <Route path="/movimentacoes" element={<MovimentacoesListPage />} />
            <Route path="/logs-tiny" element={<LogsTinyListPage />} />
            <Route path="/imagens" element={<ImagensListPage />} />

            <Route path="/usuarios" element={<UsuariosListPage />} />
            <Route path="/usuarios/novo" element={<UsuarioFormPage />} />
            <Route path="/usuarios/:id/editar" element={<UsuarioFormPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AuthProvider>
  );
}
