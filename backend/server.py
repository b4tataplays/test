from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
import aiohttp
from bs4 import BeautifulSoup
import asyncio


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class Source(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    type: str  # game, movie, series, anime, software, book
    url_base: str
    search_method: str  # api or scraping
    config: Dict[str, Any] = Field(default_factory=dict)
    enabled: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SourceCreate(BaseModel):
    name: str
    type: str
    url_base: str
    search_method: str
    config: Dict[str, Any] = Field(default_factory=dict)
    enabled: bool = True

class SourceUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    url_base: Optional[str] = None
    search_method: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    enabled: Optional[bool] = None

class SearchRequest(BaseModel):
    query: str
    type: str
    source_ids: List[str] = Field(default_factory=list)

class SearchResult(BaseModel):
    source_name: str
    items: List[Dict[str, Any]]
    error: Optional[str] = None


# Source CRUD endpoints
@api_router.post("/sources", response_model=Source)
async def create_source(input: SourceCreate):
    source_dict = input.model_dump()
    source_obj = Source(**source_dict)
    
    doc = source_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.sources.insert_one(doc)
    return source_obj

@api_router.get("/sources", response_model=List[Source])
async def get_sources():
    sources = await db.sources.find({}, {"_id": 0}).to_list(1000)
    
    for source in sources:
        if isinstance(source['created_at'], str):
            source['created_at'] = datetime.fromisoformat(source['created_at'])
    
    return sources

@api_router.get("/sources/by-type/{type}", response_model=List[Source])
async def get_sources_by_type(type: str):
    sources = await db.sources.find({"type": type, "enabled": True}, {"_id": 0}).to_list(1000)
    
    for source in sources:
        if isinstance(source['created_at'], str):
            source['created_at'] = datetime.fromisoformat(source['created_at'])
    
    return sources

@api_router.get("/sources/{id}", response_model=Source)
async def get_source(id: str):
    source = await db.sources.find_one({"id": id}, {"_id": 0})
    
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    
    if isinstance(source['created_at'], str):
        source['created_at'] = datetime.fromisoformat(source['created_at'])
    
    return source

@api_router.put("/sources/{id}", response_model=Source)
async def update_source(id: str, input: SourceUpdate):
    source = await db.sources.find_one({"id": id}, {"_id": 0})
    
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    
    update_data = {k: v for k, v in input.model_dump().items() if v is not None}
    
    if update_data:
        await db.sources.update_one({"id": id}, {"$set": update_data})
    
    updated_source = await db.sources.find_one({"id": id}, {"_id": 0})
    
    if isinstance(updated_source['created_at'], str):
        updated_source['created_at'] = datetime.fromisoformat(updated_source['created_at'])
    
    return updated_source

@api_router.delete("/sources/{id}")
async def delete_source(id: str):
    result = await db.sources.delete_one({"id": id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Source not found")
    
    return {"message": "Source deleted successfully"}


# Search functionality
async def search_with_scraping(url: str, query: str, config: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Basic scraping search - can be customized per source"""
    try:
        async with aiohttp.ClientSession() as session:
            search_url = url.format(query=query)
            async with session.get(search_url, timeout=aiohttp.ClientTimeout(total=10)) as response:
                if response.status != 200:
                    return []
                
                html = await response.text()
                soup = BeautifulSoup(html, 'html.parser')
                
                # This is a generic scraper - would need customization per site
                results = []
                
                # Example: try to find common patterns
                # In real implementation, each source would have custom selectors in config
                items = soup.find_all(config.get('item_selector', 'div'), class_=config.get('item_class'))
                
                for item in items[:10]:  # Limit to 10 results
                    result = {
                        'name': item.get_text(strip=True) if item else 'N/A',
                        'price': 'N/A',
                        'size': 'N/A',
                        'producer': 'N/A',
                        'release_date': 'N/A',
                        'image': config.get('default_image', ''),
                        'link': url
                    }
                    results.append(result)
                
                return results
    except Exception as e:
        logger.error(f"Scraping error: {str(e)}")
        return []

async def search_with_api(url: str, query: str, config: Dict[str, Any]) -> List[Dict[str, Any]]:
    """API-based search"""
    try:
        async with aiohttp.ClientSession() as session:
            headers = config.get('headers', {})
            params = config.get('params', {})
            params['q'] = query
            
            async with session.get(url, headers=headers, params=params, timeout=aiohttp.ClientTimeout(total=10)) as response:
                if response.status != 200:
                    return []
                
                data = await response.json()
                
                # Extract results based on config
                results_path = config.get('results_path', 'results')
                items = data.get(results_path, [])
                
                results = []
                for item in items[:10]:
                    result = {
                        'name': item.get(config.get('name_field', 'name'), 'N/A'),
                        'price': item.get(config.get('price_field', 'price'), 'N/A'),
                        'size': item.get(config.get('size_field', 'size'), 'N/A'),
                        'producer': item.get(config.get('producer_field', 'producer'), 'N/A'),
                        'release_date': item.get(config.get('date_field', 'release_date'), 'N/A'),
                        'image': item.get(config.get('image_field', 'image'), ''),
                        'link': item.get(config.get('link_field', 'url'), url)
                    }
                    results.append(result)
                
                return results
    except Exception as e:
        logger.error(f"API error: {str(e)}")
        return []

async def search_single_source(source: Dict[str, Any], query: str) -> SearchResult:
    """Search a single source"""
    try:
        if source['search_method'] == 'api':
            items = await search_with_api(source['url_base'], query, source.get('config', {}))
        else:
            items = await search_with_scraping(source['url_base'], query, source.get('config', {}))
        
        return SearchResult(source_name=source['name'], items=items)
    except Exception as e:
        logger.error(f"Error searching {source['name']}: {str(e)}")
        return SearchResult(source_name=source['name'], items=[], error=str(e))

@api_router.post("/search", response_model=List[SearchResult])
async def search(request: SearchRequest):
    # Get sources to search
    if request.source_ids:
        sources = await db.sources.find({"id": {"$in": request.source_ids}, "enabled": True}, {"_id": 0}).to_list(100)
    else:
        sources = await db.sources.find({"type": request.type, "enabled": True}, {"_id": 0}).to_list(100)
    
    if not sources:
        return []
    
    # Search all sources concurrently
    tasks = [search_single_source(source, request.query) for source in sources]
    results = await asyncio.gather(*tasks)
    
    return results


# Seed initial data
@api_router.post("/seed")
async def seed_data():
    # Check if already seeded
    count = await db.sources.count_documents({})
    if count > 0:
        return {"message": "Database already seeded"}
    
    initial_sources = [
        # Games
        {
            "id": str(uuid.uuid4()),
            "name": "Steam",
            "type": "game",
            "url_base": "https://store.steampowered.com/search/?term={query}",
            "search_method": "scraping",
            "config": {
                "item_selector": "a",
                "item_class": "search_result_row",
                "default_image": "https://placehold.co/300x400/6366f1/ffffff?text=Steam"
            },
            "enabled": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Epic Games",
            "type": "game",
            "url_base": "https://www.epicgames.com/store/browse?q={query}",
            "search_method": "scraping",
            "config": {
                "default_image": "https://placehold.co/300x400/8b5cf6/ffffff?text=Epic+Games"
            },
            "enabled": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "GOG",
            "type": "game",
            "url_base": "https://www.gog.com/games?query={query}",
            "search_method": "scraping",
            "config": {
                "default_image": "https://placehold.co/300x400/ec4899/ffffff?text=GOG"
            },
            "enabled": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        # Movies
        {
            "id": str(uuid.uuid4()),
            "name": "IMDb",
            "type": "movie",
            "url_base": "https://www.imdb.com/find?q={query}&s=tt&ttype=ft",
            "search_method": "scraping",
            "config": {
                "default_image": "https://placehold.co/300x400/f59e0b/ffffff?text=IMDb"
            },
            "enabled": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Netflix",
            "type": "movie",
            "url_base": "https://www.netflix.com/search?q={query}",
            "search_method": "scraping",
            "config": {
                "default_image": "https://placehold.co/300x400/dc2626/ffffff?text=Netflix"
            },
            "enabled": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Prime Video",
            "type": "movie",
            "url_base": "https://www.primevideo.com/search?phrase={query}",
            "search_method": "scraping",
            "config": {
                "default_image": "https://placehold.co/300x400/06b6d4/ffffff?text=Prime+Video"
            },
            "enabled": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        # Animes
        {
            "id": str(uuid.uuid4()),
            "name": "MyAnimeList",
            "type": "anime",
            "url_base": "https://myanimelist.net/anime.php?q={query}",
            "search_method": "scraping",
            "config": {
                "default_image": "https://placehold.co/300x400/2563eb/ffffff?text=MyAnimeList"
            },
            "enabled": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Crunchyroll",
            "type": "anime",
            "url_base": "https://www.crunchyroll.com/search?q={query}",
            "search_method": "scraping",
            "config": {
                "default_image": "https://placehold.co/300x400/f97316/ffffff?text=Crunchyroll"
            },
            "enabled": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "AniList",
            "type": "anime",
            "url_base": "https://anilist.co/search/anime?search={query}",
            "search_method": "scraping",
            "config": {
                "default_image": "https://placehold.co/300x400/8b5cf6/ffffff?text=AniList"
            },
            "enabled": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    
    await db.sources.insert_many(initial_sources)
    
    return {"message": "Database seeded successfully", "count": len(initial_sources)}


# Health check
@api_router.get("/")
async def root():
    return {"message": "Meta Search API"}


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
