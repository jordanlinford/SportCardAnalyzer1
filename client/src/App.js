import React, { useState } from 'react';
import {
  Container,
  Box,
  TextField,
  Button,
  Typography,
  CircularProgress,
  Paper,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import MarketAnalysis from './components/MarketAnalysis';

function App() {
  const [query, setQuery] = useState('');
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [marketData, setMarketData] = useState(null);

  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setImage(file);
      setQuery(''); // Clear text query when image is uploaded
    }
  };

  const handleSearch = async () => {
    setLoading(true);
    try {
      let response;
      if (image) {
        const formData = new FormData();
        formData.append('image', image);
        response = await fetch('/api/search/image', {
          method: 'POST',
          body: formData,
        });
      } else {
        response = await fetch(`/api/search?query=${encodeURIComponent(query)}`);
      }
      
      const data = await response.json();
      setResults(data.listings);
      setMarketData(data.marketAnalysis);
    } catch (error) {
      console.error('Error searching:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom align="center">
          Sports Card Market Analysis
        </Typography>

        <Paper sx={{ p: 3, mb: 4 }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
            <TextField
              fullWidth
              label="Search by text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setImage(null); // Clear image when text is entered
              }}
              disabled={!!image}
            />
            <Button
              variant="contained"
              onClick={handleSearch}
              disabled={loading || (!query && !image)}
            >
              Search
            </Button>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Button
              variant="outlined"
              component="label"
              startIcon={<CloudUploadIcon />}
              disabled={!!query}
            >
              Upload Image
              <input
                type="file"
                hidden
                accept="image/*"
                onChange={handleImageUpload}
              />
            </Button>
            {image && (
              <Typography variant="body2" color="text.secondary">
                Selected: {image.name}
              </Typography>
            )}
          </Box>
        </Paper>

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {results && marketData && (
          <MarketAnalysis
            marketData={marketData}
            listings={results}
          />
        )}
      </Box>
    </Container>
  );
}

export default App; 