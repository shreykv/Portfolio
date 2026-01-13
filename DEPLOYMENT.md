# Deployment Guide

This guide will help you deploy your portfolio website to GitHub Pages.

## Prerequisites

1. **Git installed** - Download from [git-scm.com](https://git-scm.com/download/win)
2. **GitHub account** - Sign up at [github.com](https://github.com)
3. **GitHub repository** - Create a repository named `shreykv.github.io` (must match your GitHub username)

## Step 1: Install Git (if not already installed)

1. Download Git for Windows from https://git-scm.com/download/win
2. Run the installer with default settings
3. Restart your terminal/command prompt after installation

## Step 2: Initialize Git Repository

Open PowerShell or Command Prompt in your project directory and run:

```powershell
# Navigate to your project directory (if not already there)
cd "C:\Users\shrey\Coding Files\shreykv.github.io"

# Initialize git repository
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: Portfolio website with personal access page"
```

## Step 3: Connect to GitHub

### Option A: Create New Repository on GitHub

1. Go to https://github.com/new
2. Repository name: `shreykv.github.io` (must match your username exactly)
3. Description: "Personal portfolio website"
4. Set to **Public** (required for free GitHub Pages)
5. **DO NOT** initialize with README, .gitignore, or license
6. Click "Create repository"

### Option B: Use Existing Repository

If you already have a repository, skip to Step 4.

## Step 4: Push to GitHub

```powershell
# Add GitHub remote (replace YOUR_USERNAME with your actual GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/shreykv.github.io.git

# Push to GitHub
git branch -M main
git push -u origin main
```

**Note**: You'll be prompted for your GitHub username and password. For password, use a **Personal Access Token** (not your GitHub password):
- Go to GitHub Settings > Developer settings > Personal access tokens > Tokens (classic)
- Generate new token with `repo` scope
- Use this token as your password

## Step 5: Enable GitHub Pages

1. Go to your repository on GitHub: `https://github.com/YOUR_USERNAME/shreykv.github.io`
2. Click **Settings** tab
3. Scroll down to **Pages** section (left sidebar)
4. Under **Source**, select:
   - Branch: `main`
   - Folder: `/ (root)`
5. Click **Save**

## Step 6: Access Your Website

Your website will be available at:
- **Portfolio**: `https://YOUR_USERNAME.github.io`
- **Personal Page**: `https://YOUR_USERNAME.github.io/personal.html`

**Note**: It may take a few minutes for GitHub Pages to build and deploy your site.

## Troubleshooting

### Hash-based Routing

GitHub Pages works with hash-based routing (which we've already implemented). Your URLs will look like:
- `https://YOUR_USERNAME.github.io/personal.html#/personal/gym-log`

### 404 Errors

If you get 404 errors:
1. Check that your repository is named exactly `YOUR_USERNAME.github.io`
2. Ensure GitHub Pages is enabled in Settings > Pages
3. Wait 5-10 minutes after enabling Pages
4. Check the Actions tab for any build errors

### Updating Your Site

After making changes:

```powershell
git add .
git commit -m "Description of changes"
git push
```

Changes will be live within a few minutes.

## Alternative: Manual File Upload

If you prefer not to use Git:

1. Go to your GitHub repository
2. Click "Add file" > "Upload files"
3. Drag and drop all your files
4. Commit changes
5. Enable GitHub Pages as described in Step 5

## Security Note

Remember to change the default password in `js/auth.js` before deploying:
- Default password: `personal2024`
- Change it to something secure before going live
