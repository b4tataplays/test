import { useState, useEffect } from "react";
import axios from "axios";
import { ArrowLeft, Plus, Edit, Trash2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const CONTENT_TYPES = [
  { value: "game", label: "Jogos" },
  { value: "movie", label: "Filmes" },
  { value: "series", label: "Séries" },
  { value: "anime", label: "Animes" },
  { value: "software", label: "Softwares" },
  { value: "book", label: "Livros" }
];

const SEARCH_METHODS = [
  { value: "api", label: "API" },
  { value: "scraping", label: "Web Scraping" }
];

const Admin = () => {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSource, setEditingSource] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    type: "game",
    url_base: "",
    search_method: "scraping",
    config: "{}",
    enabled: true
  });

  useEffect(() => {
    loadSources();
    seedDatabase();
  }, []);

  const seedDatabase = async () => {
    try {
      await axios.post(`${API}/seed`);
    } catch (error) {
      console.error("Error seeding:", error);
    }
  };

  const loadSources = async () => {
    try {
      const response = await axios.get(`${API}/sources`);
      setSources(response.data);
    } catch (error) {
      console.error("Error loading sources:", error);
      toast.error("Erro ao carregar fontes");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      // Validate config JSON
      let configObj = {};
      try {
        configObj = JSON.parse(formData.config);
      } catch (e) {
        toast.error("Configuração JSON inválida");
        return;
      }

      const data = {
        ...formData,
        config: configObj
      };

      if (editingSource) {
        await axios.put(`${API}/sources/${editingSource.id}`, data);
        toast.success("Fonte atualizada com sucesso");
      } else {
        await axios.post(`${API}/sources`, data);
        toast.success("Fonte criada com sucesso");
      }

      setDialogOpen(false);
      resetForm();
      loadSources();
    } catch (error) {
      console.error("Error saving source:", error);
      toast.error("Erro ao salvar fonte");
    }
  };

  const handleEdit = (source) => {
    setEditingSource(source);
    setFormData({
      name: source.name,
      type: source.type,
      url_base: source.url_base,
      search_method: source.search_method,
      config: JSON.stringify(source.config, null, 2),
      enabled: source.enabled
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Tem certeza que deseja excluir esta fonte?")) {
      return;
    }

    try {
      await axios.delete(`${API}/sources/${id}`);
      toast.success("Fonte excluída com sucesso");
      loadSources();
    } catch (error) {
      console.error("Error deleting source:", error);
      toast.error("Erro ao excluir fonte");
    }
  };

  const handleToggleEnabled = async (source) => {
    try {
      await axios.put(`${API}/sources/${source.id}`, {
        enabled: !source.enabled
      });
      loadSources();
    } catch (error) {
      console.error("Error toggling source:", error);
      toast.error("Erro ao atualizar fonte");
    }
  };

  const resetForm = () => {
    setEditingSource(null);
    setFormData({
      name: "",
      type: "game",
      url_base: "",
      search_method: "scraping",
      config: "{}",
      enabled: true
    });
  };

  const handleDialogOpenChange = (open) => {
    setDialogOpen(open);
    if (!open) {
      resetForm();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
      {/* Header */}
      <header className="bg-white/70 backdrop-blur-md border-b border-white/20 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button
              data-testid="back-button"
              variant="ghost"
              onClick={() => window.location.href = '/'}
              className="hover:bg-blue-50"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Administração de Fontes
            </h1>
          </div>
          <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
            <DialogTrigger asChild>
              <Button
                data-testid="add-source-button"
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
              >
                <Plus className="w-5 h-5 mr-2" />
                Nova Fonte
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingSource ? "Editar Fonte" : "Nova Fonte"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="name">Nome da Plataforma</Label>
                  <Input
                    id="name"
                    data-testid="source-name-input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Steam, Netflix, etc."
                  />
                </div>

                <div>
                  <Label htmlFor="type">Tipo de Conteúdo</Label>
                  <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                    <SelectTrigger data-testid="source-type-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTENT_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="url">URL Base</Label>
                  <Input
                    id="url"
                    data-testid="source-url-input"
                    value={formData.url_base}
                    onChange={(e) => setFormData({ ...formData, url_base: e.target.value })}
                    placeholder="https://example.com/search?q={query}"
                  />
                  <p className="text-xs text-gray-500 mt-1">Use {'{query}'} onde a palavra-chave deve aparecer</p>
                </div>

                <div>
                  <Label htmlFor="method">Método de Busca</Label>
                  <Select value={formData.search_method} onValueChange={(value) => setFormData({ ...formData, search_method: value })}>
                    <SelectTrigger data-testid="source-method-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SEARCH_METHODS.map(method => (
                        <SelectItem key={method.value} value={method.value}>
                          {method.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="config">Configuração (JSON)</Label>
                  <Textarea
                    id="config"
                    data-testid="source-config-input"
                    value={formData.config}
                    onChange={(e) => setFormData({ ...formData, config: e.target.value })}
                    placeholder='{"default_image": "https://..."}'
                    className="font-mono text-sm"
                    rows={6}
                  />
                  <p className="text-xs text-gray-500 mt-1">Configurações personalizadas em formato JSON</p>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="enabled"
                    data-testid="source-enabled-switch"
                    checked={formData.enabled}
                    onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
                  />
                  <Label htmlFor="enabled">Fonte ativa</Label>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    data-testid="save-source-button"
                    onClick={handleSubmit}
                    className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Salvar
                  </Button>
                  <Button
                    data-testid="cancel-button"
                    variant="outline"
                    onClick={() => handleDialogOpenChange(false)}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancelar
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Carregando...</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {sources.length === 0 ? (
              <div className="text-center py-12 bg-white/80 backdrop-blur-lg rounded-xl">
                <p className="text-gray-500">Nenhuma fonte cadastrada ainda</p>
              </div>
            ) : (
              sources.map((source) => (
                <div
                  key={source.id}
                  data-testid={`source-item-${source.id}`}
                  className="bg-white/80 backdrop-blur-lg rounded-xl shadow-lg border border-white/20 p-6 hover:shadow-xl transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-gray-800">{source.name}</h3>
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                          {CONTENT_TYPES.find(t => t.value === source.type)?.label || source.type}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          source.enabled
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {source.enabled ? 'Ativa' : 'Inativa'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{source.url_base}</p>
                      <p className="text-xs text-gray-500">
                        Método: <span className="font-semibold">{source.search_method}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={source.enabled}
                        onCheckedChange={() => handleToggleEnabled(source)}
                      />
                      <Button
                        data-testid={`edit-source-${source.id}`}
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(source)}
                        className="hover:bg-blue-50"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        data-testid={`delete-source-${source.id}`}
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(source.id)}
                        className="hover:bg-red-50 hover:border-red-300 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default Admin;
