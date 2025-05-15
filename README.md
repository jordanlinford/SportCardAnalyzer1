# Sports Card Analyzer

A full-stack application for managing sports card collections with automatic market value tracking and display case features.

## Features

- User authentication and authorization with Firebase
- Card collection management (CRUD operations)
- Display cases to showcase collections
- Public sharing of display cases
- Automatic market value tracking using eBay data
- Trade analyzer to compare card values
- Mobile-responsive design with modern UI
- PWA support for mobile devices

## Tech Stack

### Frontend
- React with TypeScript
- Vite for fast development
- Tailwind CSS for styling
- Firebase for authentication and storage
- React Router for navigation

### Backend
- Node.js Express server
- Firebase Admin SDK
- Web scraping for real-time eBay data

## Recent Improvements

1. **Mobile Responsiveness**
   - Hamburger menu for mobile navigation
   - Touch-optimized UI elements
   - Responsive layouts and proper sizing
   - iOS-specific meta tags and PWA support

2. **Firebase Integration**
   - Improved Firebase Admin SDK initialization
   - Better error handling for authentication
   - Mock implementations for development

3. **UI Enhancements**
   - SVG logo implementation
   - Better display of card images in display cases
   - More consistent UI components

4. **Bug Fixes**
   - Fixed missing UI components
   - Improved routing and navigation
   - Added robust error handling

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- Firebase account
- Git

### Installation

1. Clone the repository:
```bash
git clone https://github.com/jordanlinford/SportCardAnalyzer.git
cd SportCardAnalyzer
```

2. Install dependencies:
```bash
npm install
cd server
npm install
```

3. Set up environment variables:
- Create a `.env` file in the root directory
- Add your Firebase configuration

### Running the Application

1. Start the frontend development server:
```bash
npm run dev
```

2. Start the backend server:
```bash
cd server
npm run dev
```

3. Open your browser and navigate to `http://localhost:5173`

## Server Configuration

1. **Frontend**: Running on port 5173 with Vite
2. **Backend**: Running on port 3001 with Node.js
3. **Firebase**: Configured with proper error handling

## Future Roadmap

1. **Pokémon TCG Support**: Adding support for Pokémon cards
2. **Image Search**: Implementing card search by image upload/camera
3. **Mobile App**: Developing dedicated mobile application

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License 