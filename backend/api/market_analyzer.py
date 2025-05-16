from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import sys
import os
import logging
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import json

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import the analyzer
try:
    from analyzers.market_analyzer import MarketAnalyzer
except ImportError:
    # Fallback for when imports are different in production
    class MarketAnalyzer:
        def analyze(self, sales_data):
            return {
                "trend": "Upward",
                "volatility": 0.2,
                "liquidity": 0.5,
                "investment_rating": "Hold"
            }

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("market-analyzer-api")

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Specify your domains in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request model
class AnalyzeMarketRequest(BaseModel):
    playerName: str
    year: Optional[str] = None
    cardSet: Optional[str] = None
    variation: Optional[str] = None
    cardNumber: Optional[str] = None
    grade: Optional[str] = "any"
    query: Optional[str] = None
    negKeywords: Optional[List[str]] = None

# Mock data generator
def get_mock_sales_data(player_name: str) -> List[Dict[str, Any]]:
    """Generate mock sales data for testing"""
    import random
    from datetime import datetime, timedelta
    
    today = datetime.now()
    sales_data = []
    
    # Generate 20 data points over the last 90 days
    for i in range(20):
        days_ago = random.randint(1, 90)
        date = today - timedelta(days=days_ago)
        
        # Base price with some randomness
        base_price = 100 + (90 - days_ago) * 0.5  # Slight upward trend
        variation = random.uniform(-10, 10)
        price = max(10, base_price + variation)
        
        sales_data.append({
            "date": date.strftime("%Y-%m-%d"),
            "price": round(price, 2),
            "title": f"{player_name} Card #{random.randint(1, 300)}",
            "condition": random.choice(["Mint", "Near Mint", "Excellent", "Good"]),
            "platform": "eBay"
        })
    
    return sales_data

@app.get("/")
async def root():
    return {"message": "Market Analyzer API"}

@app.post("/api/market-analyzer")
async def analyze_market(request: AnalyzeMarketRequest):
    logger.info(f"Received request for player: {request.playerName}")
    
    try:
        # Initialize analyzer
        analyzer = MarketAnalyzer()
        
        # Get data (mocked for now)
        player_name = request.playerName
        if not player_name and request.query:
            # Extract player name from query if direct name not provided
            query_parts = request.query.split()
            player_name = " ".join(query_parts[:2])  # Use first two words as player name
        
        sales_data = get_mock_sales_data(player_name)
        
        # Analyze the data
        analysis_results = analyzer.analyze(sales_data)
        
        # Return results
        return {
            "success": True,
            "marketAnalysis": {
                "trend": analysis_results.get("trend", "Unknown"),
                "volatility": analysis_results.get("volatility", 0.3),
                "liquidity": analysis_results.get("liquidity", 0.4),
                "investment_rating": analysis_results.get("investment_rating", "Hold"),
                "listings": sales_data
            }
        }
    except Exception as e:
        logger.error(f"Error processing request: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(e)}
        )

# Vercel serverless function handler
async def handler(request: Request):
    """
    Adapter for Vercel serverless function
    This function is called by Vercel when deployed
    """
    # Parse request path and method
    path = request.url.path
    method = request.method
    
    if path == "/api/market-analyzer" and method == "POST":
        try:
            # Parse the JSON body
            body = await request.json()
            
            # Convert to our request model
            analyze_request = AnalyzeMarketRequest(**body)
            
            # Process request
            result = await analyze_market(analyze_request)
            
            # Return response
            return JSONResponse(content=result)
        except Exception as e:
            logger.error(f"Error handling request: {str(e)}")
            return JSONResponse(
                status_code=500,
                content={"success": False, "error": str(e)}
            )
    
    # Default response
    return JSONResponse(content={"message": "Market Analyzer API"})

# For local development with Uvicorn
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 