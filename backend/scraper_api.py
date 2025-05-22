from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging
import traceback

# Logging setup
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Initialize Firebase (only once in the app lifecycle)
try:
    logger.debug("Initializing Firebase...")
    from utils.auth import verify_token  # This will initialize Firebase
    logger.debug("Importing card routes...")
    from card_routes import router as card_router
    logger.debug("All imports successful")
except Exception as e:
    logger.error(f"Import error: {str(e)}")
    raise

app = FastAPI(title="Sports Card Market Analysis API")

# Enable CORS - specific to your domain
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://sportscardanalyzer.com"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=86400
)

# Register routes
logger.debug("Including routers...")
app.include_router(card_router)
logger.debug("Router included successfully")

# Handle OPTIONS requests explicitly
@app.options("/{full_path:path}")
async def options_route(request: Request, full_path: str):
    logger.debug(f"OPTIONS request received for path: {full_path}")
    return JSONResponse(
        content={},
        headers={
            "Access-Control-Allow-Origin": "https://sportscardanalyzer.com",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Max-Age": "86400",
            "Access-Control-Allow-Credentials": "true"
        }
    )

@app.get("/")
async def root():
    try:
        logger.debug("Root endpoint hit")
        return {"message": "Sports Card Market Analysis API"}
    except Exception as e:
        logger.error(f"Error in root: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))
