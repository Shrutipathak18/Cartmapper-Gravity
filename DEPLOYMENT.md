# CartMapper Deployment (Netlify + Render)

This setup keeps frontend behavior unchanged (`VITE_API_URL=/api`) and deploys backend with persistent storage.

## 1) Deploy backend on Render

1. Push this repository to GitHub.
2. In Render, choose **New +** -> **Blueprint**.
3. Select your repo. Render will read `render.yaml`.
4. In backend service env vars, set these values:
   - `FRONTEND_URL=https://<your-netlify-domain>`
   - `ALLOWED_ORIGINS=["https://<your-netlify-domain>"]`
   - `GOOGLE_REDIRECT_URI=https://<your-netlify-domain>/auth/callback`
   - `GOOGLE_CLIENT_ID=<your-google-client-id>`
   - `GOOGLE_CLIENT_SECRET=<your-google-client-secret>`
   - `GROQ_API_KEY=<your-groq-key>`
5. Deploy and copy backend URL, for example:
   - `https://cartmapper-backend.onrender.com`

## 2) Wire frontend proxy to backend

1. Open `netlify.toml`.
2. Replace:
   - `https://REPLACE-WITH-YOUR-RENDER-BACKEND.onrender.com/:splat`
3. With your real backend URL:
   - `https://cartmapper-backend.onrender.com/:splat`
4. Commit and push.

## 3) Deploy frontend on Netlify

1. In Netlify, create site from Git.
2. Use repository root (do not switch directory manually).
3. Netlify will use `netlify.toml`:
   - base: `frontend`
   - build: `npm run build`
   - publish: `dist`
4. Set env variable:
   - `VITE_API_URL=/api`
5. Deploy.

## 4) Google OAuth Console update

In Google Cloud Console, update OAuth settings:

1. Authorized JavaScript origins:
   - `https://<your-netlify-domain>`
2. Authorized redirect URIs:
   - `https://<your-netlify-domain>/auth/callback`

## 5) Verify production

1. Open frontend URL and test login.
2. Confirm API health through frontend:
   - `GET /api/health` should return healthy.
3. Upload one CSV/PDF and verify features still work.
4. Redeploy backend once and confirm data under `/var/data` persists.

## Notes

1. Backend `.env` currently contains real-looking secrets. Rotate JWT, Google, and Groq keys before go-live.
2. `render.yaml` already maps uploads and ChromaDB to persistent disk paths.
