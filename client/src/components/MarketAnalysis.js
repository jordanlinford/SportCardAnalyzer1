import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  List,
  ListItem,
  ListItemText,
  Divider,
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';

const MarketAnalysis = ({ marketData, listings }) => {
  const getTrendIcon = (trend) => {
    switch (trend) {
      case 'upward':
        return <TrendingUpIcon color="success" />;
      case 'downward':
        return <TrendingDownIcon color="error" />;
      default:
        return <TrendingFlatIcon color="action" />;
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  };

  return (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h5" gutterBottom>
        Market Analysis
      </Typography>
      
      <Grid container spacing={3}>
        {/* Price Overview Card */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Price Overview
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Typography variant="h4" component="div" sx={{ mr: 1 }}>
                  {formatPrice(marketData.averagePrice)}
                </Typography>
                {getTrendIcon(marketData.priceTrend)}
              </Box>
              <Typography variant="body2" color="text.secondary">
                Price Range: {formatPrice(marketData.priceRange.min)} - {formatPrice(marketData.priceRange.max)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Market Insights Card */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Market Insights
              </Typography>
              <List>
                {marketData.marketInsights.map((insight, index) => (
                  <React.Fragment key={index}>
                    <ListItem>
                      <ListItemText
                        primary={insight.type.split('_').map(word => 
                          word.charAt(0).toUpperCase() + word.slice(1)
                        ).join(' ')}
                        secondary={insight.message}
                      />
                    </ListItem>
                    {index < marketData.marketInsights.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Listings */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent Listings
              </Typography>
              <Grid container spacing={2}>
                {listings.slice(0, 6).map((listing, index) => (
                  <Grid item xs={12} sm={6} md={4} key={index}>
                    <Card variant="outlined">
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                          <Typography variant="subtitle1" noWrap sx={{ flex: 1 }}>
                            {listing.title}
                          </Typography>
                          <Chip
                            label={formatPrice(listing.price)}
                            color="primary"
                            size="small"
                          />
                        </Box>
                        <Typography variant="body2" color="text.secondary">
                          Sold: {new Date(listing.dateSold).toLocaleDateString()}
                        </Typography>
                        {listing.condition && (
                          <Chip
                            label={listing.condition}
                            size="small"
                            sx={{ mt: 1 }}
                          />
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default MarketAnalysis; 