from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from utils.auth import verify_token
import logging
import traceback

router = APIRouter()
logger = logging.getLogger(__name__)

# Example model for a card
class Card(BaseModel):
    player: str
    year: int
    team: str | None = None

# Market analysis request model
class MarketAnalysisRequest(BaseModel):
    playerName: str
    condition: str = "raw"

# Market analysis response model
class MarketAnalysisResponse(BaseModel):
    trend: float
    investment_rating: str
    volatility: float | None
    liquidity: float | None
    last_updated: str

# Protected route to add a card
@router.post("/cards")
async def add_card(card: Card, user=Depends(verify_token)):
    # 'user' is the authenticated Firebase user
    return {
        "message": f"Card added for {card.player}",
        "user_id": user["uid"],
        "card": card
    }

# Market analysis endpoint
@router.post("/market/analyze")
async def analyze_market(request: MarketAnalysisRequest):
    try:
        logger.debug(f"Analyzing market for {request.playerName}")
        # TODO: Implement actual market analysis logic
        # For now, return mock data
        return MarketAnalysisResponse(
            trend=0.5,
            investment_rating="NEUTRAL",
            volatility=0.2,
            liquidity=0.8,
            last_updated="2024-03-20T00:00:00Z"
        )
    except Exception as e:
        logger.error(f"Error analyzing market: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

# Get card price history
@router.get("/market/price-history/{player_name}")
async def get_price_history(player_name: str, condition: str = "raw"):
    try:
        logger.debug(f"Getting price history for {player_name}")
        # TODO: Implement actual price history logic
        # For now, return mock data
        return {
            "prices": [
                {"date": "2024-03-01", "price": 100},
                {"date": "2024-03-15", "price": 120},
                {"date": "2024-03-20", "price": 115}
            ]
        }
    except Exception as e:
        logger.error(f"Error getting price history: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

# You can add more routes here, and apply 'Depends(verify_token)' to any that need protection 