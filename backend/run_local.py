import uvicorn

if __name__ == "__main__":
    print("Starting local server on http://localhost:3001")
    uvicorn.run("scraper_api:app", host="0.0.0.0", port=3001, reload=True) 