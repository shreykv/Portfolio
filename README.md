# Portfolio Website

Personal portfolio website for Shrey Vasisht with a password-protected personal access page containing mini sites.

## Structure

- **`index.html`** - Main portfolio page (public)
- **`personal.html`** - Password-protected personal access page with mini sites
- **`js/`** - JavaScript modules
  - `router.js` - Client-side routing system
  - `auth.js` - Password authentication
  - `api.js` - Backend API client with localStorage fallback
  - `gym-log.js` - Gym log mini site
  - `tournament.js` - Tournament generator mini site
  - `counter.js` - Interactive counter mini site
- **`css/`** - Stylesheets
  - `personal.css` - Styles for personal access page

## Features

### Portfolio (Public)
- Hero section with introduction
- Portfolio projects showcase
- About and skills sections
- Contact form

### Personal Access Page (Password Protected)
- **Gym Log**: Track workouts with date, exercise, sets, reps, and weight
- **Tournament Generator**: Create and manage tournaments (single/double elimination, round-robin)
- **Interactive Counter**: Multiple named counters with increment/decrement/reset

## Setup

### Local Development

1. Clone the repository
2. Open `index.html` in a web browser or use a local server:
   ```bash
   # Using Python
   python -m http.server 8000
   
   # Using Node.js (http-server)
   npx http-server
   ```
3. Navigate to `http://localhost:8000` for the portfolio
4. Navigate to `http://localhost:8000/personal.html` for the personal access page

### GitHub Pages Deployment

1. Push the repository to GitHub
2. Enable GitHub Pages in repository settings
3. The site will be available at `https://yourusername.github.io`

**Note**: For GitHub Pages, you may need to configure routing. Consider using a `404.html` file that redirects to handle client-side routing, or use hash-based routing instead of path-based routing.


### Backend API Integration

The site is configured to work with localStorage by default. To integrate with a backend API:

1. Update `js/api.js`:
   ```javascript
   this.baseURL = 'https://your-api-url.com'; // Your API base URL
   this.useBackend = true; // Enable backend integration
   ```

2. Implement the following API endpoints:
   - `POST /api/auth/login` - Authentication
   - `GET /api/gym-log` - Get all workouts
   - `POST /api/gym-log` - Create workout
   - `PUT /api/gym-log` - Update workout
   - `DELETE /api/gym-log` - Delete workout
   - `GET /api/tournaments` - Get all tournaments
   - `POST /api/tournaments` - Create tournament
   - `PUT /api/tournaments` - Update tournament
   - `DELETE /api/tournaments` - Delete tournament
   - `GET /api/counters` - Get counters
   - `POST /api/counters` - Save counters
   - `PUT /api/counters` - Update counter
   - `DELETE /api/counters` - Delete counter

3. Recommended backend options:
   - **Firebase**: Real-time database with authentication
   - **Supabase**: Open-source Firebase alternative
   - **Custom Node.js API**: Full control over backend
   - **Serverless Functions**: Vercel, Netlify, or AWS Lambda

## Data Storage

### Current Implementation (localStorage)

All data is stored in the browser's localStorage. This means:
- Data persists across sessions on the same device/browser
- Data is not synced across devices
- Data can be cleared by clearing browser data

### Export/Import

- **Gym Log**: Export button available in the gym log interface
- **Counters**: Export button available in the counter interface
- Data is exported as JSON files

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Requires JavaScript enabled
- Responsive design for mobile devices

## Customization

### Styling

The design system uses CSS variables defined in `index.html` and `personal.html`. Key variables:
- `--bg`: Background color
- `--text`: Primary text color
- `--accent`: Accent color (#6EE7FF)
- `--accent2`: Secondary accent (#A78BFA)
- `--border`: Border color
- `--radius`: Border radius

### Adding New Mini Sites

1. Create a new JavaScript file in `js/` (e.g., `js/new-site.js`)
2. Create a class that handles the mini site logic
3. Register the route in `personal.html`:
   ```javascript
   router.register('/personal/new-site', () => {
     document.getElementById('app-content').innerHTML = '<div id="new-site-content"></div>';
     newSite.render();
   });
   ```
4. Add navigation link in `personal.html`

## Troubleshooting

### Routing Issues on GitHub Pages

GitHub Pages doesn't support client-side routing by default. Solutions:
1. Use hash-based routing (`#/personal/gym-log` instead of `/personal/gym-log`)
2. Create a `404.html` file that redirects to `index.html` and handles routing
3. Use a static site generator that supports routing

### Password Not Working

- Check that the password in `js/auth.js` matches what you're entering
- Clear browser localStorage/sessionStorage if needed
- Check browser console for errors

### Data Not Persisting

- Ensure localStorage is enabled in your browser
- Check browser storage limits
- Verify that data is being saved (check browser DevTools > Application > Local Storage)

## License

This project is open source and available for personal use.
