# Local Testing Guide

Quick reference for testing your portfolio website locally before deploying to GitHub Pages.

## Quick Start

### Option 1: Python HTTP Server (Recommended)

**Windows (Batch Script):**
1. Double-click `start-server.bat`
2. Server starts automatically
3. Browser opens to `http://localhost:8000`

**Windows (PowerShell):**
1. Right-click `start-server.ps1` → Run with PowerShell
2. Server starts automatically
3. Browser opens to `http://localhost:8000`

**Manual (Any OS):**
```bash
python -m http.server 8000
```
Then open `http://localhost:8000` in your browser.

### Option 2: Node.js HTTP Server

**First time setup:**
```bash
npm install
```

**Start server:**
```bash
npm start
```

Or use npx (no installation needed):
```bash
npx http-server -p 8000 -o
```

## URLs

- **Portfolio (Main Page):** `http://localhost:8000`
- **Personal Page:** `http://localhost:8000/personal.html`
- **Personal Page Routes:**
  - Gym Log: `http://localhost:8000/personal.html#/personal/gym-log`
  - Tournament: `http://localhost:8000/personal.html#/personal/tournament`
  - Counter: `http://localhost:8000/personal.html#/personal/counter`

## Testing Checklist

### Main Portfolio Page
- [ ] Page loads correctly
- [ ] Navigation links work (Portfolio, About, Skills, Contact)
- [ ] Smooth scrolling to sections
- [ ] Contact form submits (opens email client)
- [ ] Social links work (LinkedIn, GitHub, Email)
- [ ] Responsive design (test on mobile viewport)

### Personal Access Page
- [ ] Password protection works
- [ ] Default password: `personal2024` (check `js/auth.js` to verify)
- [ ] Login/logout functions correctly
- [ ] Navigation between mini sites works

### Gym Log
- [ ] Add workout entries
- [ ] View workout list
- [ ] Filter workouts
- [ ] Edit workouts
- [ ] Delete workouts
- [ ] Export data (downloads JSON file)
- [ ] Data persists after page refresh (localStorage)

### Tournament Generator
- [ ] Create tournament
- [ ] Select tournament type (single/double elimination, round-robin)
- [ ] Add participants
- [ ] Generate bracket/matches
- [ ] Record match results
- [ ] View tournament progress
- [ ] Data persists (localStorage)

### Counter
- [ ] Create new counters
- [ ] Increment/decrement counters
- [ ] Reset counters
- [ ] Delete counters
- [ ] Export data
- [ ] Data persists (localStorage)

## Stopping the Server

- **Python:** Press `Ctrl+C` in the terminal window
- **Node.js:** Press `Ctrl+C` in the terminal window

## Troubleshooting

### Port 8000 Already in Use

**Python:**
```bash
python -m http.server 8080
```
Then access at `http://localhost:8080`

**Node.js:**
```bash
npx http-server -p 8080 -o
```

### Python Not Found

- Ensure Python is installed: https://www.python.org/downloads/
- Make sure Python is in your system PATH
- Try using `python3` instead of `python` on some systems

### JavaScript Errors in Browser

1. Open browser DevTools (F12)
2. Check Console tab for errors
3. Check Network tab for failed requests
4. Ensure you're using `http://localhost:8000` not `file://` URLs

### Data Not Persisting

- Check that localStorage is enabled in browser
- Open DevTools > Application > Local Storage
- Verify data is being saved
- Some browsers block localStorage in private/incognito mode

### Routing Not Working

- Personal page uses hash-based routing (`#/personal/...`)
- Ensure you're accessing via HTTP server, not file://
- Check browser console for routing errors

## Browser Compatibility

Tested in:
- Chrome/Edge (recommended)
- Firefox
- Safari

## Why Use a Local Server?

Your website uses JavaScript features that require HTTP protocol:
- `fetch()` API
- Module imports (if using ES modules)
- CORS-safe resource loading
- localStorage (works better over HTTP)

Opening HTML files directly (`file://`) can cause:
- CORS errors
- JavaScript security restrictions
- localStorage issues
- Broken relative paths
