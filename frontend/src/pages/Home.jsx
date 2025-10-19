import { useState, useEffect } from "react";
import axios from "axios";
import { Search, Loader2, ExternalLink, Calendar, Package, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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

const Home = () => {
  const [query, setQuery] = useState("");
  const [contentType, setContentType] = useState("game");
  const [sources, setSources] = useState([]);
  const [selectedSources, setSelectedSources] = useState([]);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    loadSources();
  }, [contentType]);

  const loadSources = async () => {
    try {
      const response = await axios.get(`${API}/sources/by-type/${contentType}`);
      setSources(response.data);
      setSelectedSources(response.data.map(s => s.id));
    } catch (error) {
      console.error("Error loading sources:", error);
      toast.error("Erro ao carregar fontes");
    }
  };

  const toggleSource = (sourceId) => {
    setSelectedSources(prev =>
      prev.includes(sourceId)
        ? prev.filter(id => id !== sourceId)
        : [...prev, sourceId]
    );
  };

  const handleSearch = async () => {
    if (!query.trim()) {
      toast.error("Digite algo para buscar");
      return;
    }

    if (selectedSources.length === 0) {
      toast.error("Selecione ao menos uma fonte");
      return;
    }

    setSearching(true);
    setHasSearched(true);

    try {
      const response = await axios.post(`${API}/search`, {
        query: query.trim(),
        type: contentType,
        source_ids: selectedSources
      });

      setResults(response.data);
      
      if (response.data.every(r => r.items.length === 0)) {
        toast.info("Nenhum resultado encontrado");
      }
    } catch (error) {
      console.error("Search error:", error);
      toast.error("Erro ao realizar busca");
    } finally {
      setSearching(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
      {/* Header */}
      <header className="bg-white/70 backdrop-blur-md border-b border-white/20 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Search className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              MetaSearch
            </h1>
          </div>
          <Button
            data-testid="admin-button"
            variant="outline"
            onClick={() => window.location.href = '/admin'}
            className="hover:bg-blue-50 hover:border-blue-300 transition-all"
          >
            Admin
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        {/* Search Section */}
        <div className="max-w-4xl mx-auto mb-12">
          <div className="text-center mb-8">
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent" style={{fontFamily: '"Space Grotesk", sans-serif'}}>
              Busca Universal
            </h2>
            <p className="text-lg text-gray-600">Encontre jogos, filmes, animes e muito mais em múltiplas plataformas</p>
          </div>

          {/* Search Card */}
          <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 p-8">
            {/* Search Input */}
            <div className="flex gap-3 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  data-testid="search-input"
                  type="text"
                  placeholder="O que você está procurando?"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="pl-12 h-14 text-lg border-2 focus:border-blue-500 rounded-xl"
                />
              </div>
              <Button
                data-testid="search-button"
                onClick={handleSearch}
                disabled={searching}
                className="h-14 px-8 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all"
              >
                {searching ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Buscando...
                  </>
                ) : (
                  <>
                    <Search className="w-5 h-5 mr-2" />
                    Buscar
                  </>
                )}
              </Button>
            </div>

            {/* Content Type Selector */}
            <div className="mb-6">
              <Label className="text-sm font-semibold mb-2 block text-gray-700">Tipo de Conteúdo</Label>
              <Select value={contentType} onValueChange={setContentType}>
                <SelectTrigger data-testid="content-type-select" className="h-12 border-2 rounded-xl">
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

            {/* Sources Selection */}
            {sources.length > 0 && (
              <div>
                <Label className="text-sm font-semibold mb-3 block text-gray-700">Fontes de Busca</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {sources.map(source => (
                    <div
                      key={source.id}
                      data-testid={`source-${source.id}`}
                      className="flex items-center space-x-2 p-3 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer"
                      onClick={() => toggleSource(source.id)}
                    >
                      <Checkbox
                        id={source.id}
                        checked={selectedSources.includes(source.id)}
                        onCheckedChange={() => toggleSource(source.id)}
                      />
                      <label
                        htmlFor={source.id}
                        className="text-sm font-medium cursor-pointer select-none"
                      >
                        {source.name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Results Section */}
        {hasSearched && (
          <div className="max-w-7xl mx-auto">
            <h3 className="text-2xl font-bold mb-6 text-gray-800">Resultados</h3>
            
            {results.map((sourceResult, idx) => (
              <div key={idx} className="mb-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <Search className="w-4 h-4 text-white" />
                  </div>
                  <h4 className="text-xl font-bold text-gray-800">{sourceResult.source_name}</h4>
                  <span className="text-sm text-gray-500">({sourceResult.items.length} resultados)</span>
                </div>

                {sourceResult.error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                    <p className="text-sm text-red-600">Erro: {sourceResult.error}</p>
                  </div>
                )}

                {sourceResult.items.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {sourceResult.items.map((item, itemIdx) => (
                      <div
                        key={itemIdx}
                        data-testid={`result-card-${idx}-${itemIdx}`}
                        className="bg-white/80 backdrop-blur-lg rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden border border-white/20 hover:scale-105"
                      >
                        {/* Image */}
                        <div className="h-48 bg-gradient-to-br from-blue-400 to-purple-500 relative overflow-hidden">
                          {item.image && item.image !== 'N/A' ? (
                            <img
                              src={item.image}
                              alt={item.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.src = 'https://placehold.co/300x400/6366f1/ffffff?text=No+Image';
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="w-16 h-16 text-white/50" />
                            </div>
                          )}
                        </div>

                        {/* Content */}
                        <div className="p-4">
                          <h5 className="font-bold text-gray-800 mb-2 line-clamp-2 min-h-[3rem]">
                            {item.name}
                          </h5>

                          <div className="space-y-2 text-sm text-gray-600 mb-4">
                            {item.price !== 'N/A' && (
                              <p className="flex items-center gap-2">
                                <span className="font-semibold">Preço:</span>
                                <span className="text-green-600 font-bold">{item.price}</span>
                              </p>
                            )}
                            {item.size !== 'N/A' && (
                              <p className="flex items-center gap-2">
                                <Package className="w-4 h-4" />
                                <span>{item.size}</span>
                              </p>
                            )}
                            {item.producer !== 'N/A' && (
                              <p className="flex items-center gap-2">
                                <Building2 className="w-4 h-4" />
                                <span className="line-clamp-1">{item.producer}</span>
                              </p>
                            )}
                            {item.release_date !== 'N/A' && (
                              <p className="flex items-center gap-2">
                                <Calendar className="w-4 h-4" />
                                <span>{item.release_date}</span>
                              </p>
                            )}
                          </div>

                          <Button
                            data-testid={`view-button-${idx}-${itemIdx}`}
                            onClick={() => window.open(item.link, '_blank')}
                            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-lg"
                          >
                            <ExternalLink className="w-4 h-4 mr-2" />
                            Ver/Comprar
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  !sourceResult.error && (
                    <div className="bg-gray-50 rounded-lg p-6 text-center">
                      <p className="text-gray-500">Nenhum resultado encontrado nesta fonte</p>
                    </div>
                  )
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Home;
