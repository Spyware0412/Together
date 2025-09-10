🤝 Together

Together is a sync-enabled video player built with Next.js, allowing multiple users to watch content in real-time. It integrates with TMDb for movie data, OpenSubtitles for subtitles, and uses Firebase to handle room sync and persistence.

✨ Features

🔄 Real-time Sync – multiple users can watch the same video together.

🎥 Custom Video Player – supports multiple subtitle tracks.

🎬 TMDb Integration – search movies by title and fetch full details.

📜 Subtitle Support – fetches from OpenSubtitles and auto-converts .srt → .vtt.

🏠 Room System – create/join rooms with unique IDs.

⚡ Realtime Database – syncs play/pause/seek across users.

☁️ Firestore Database – stores room and user metadata.

🎨 Tailwind CSS – responsive, modern UI.

🛠️ Tech Stack

Framework: Next.js

UI: Tailwind CSS

Realtime Sync: Firebase Realtime Database

Database: Firestore

APIs:

TMDb
 – movie details

OpenSubtitles
 – subtitles

🚀 Getting Started
1. Clone the repo
git clone https://github.com/your-username/together.git
cd together

2. Install dependencies
npm install
# or
yarn install

3. Setup environment variables

Create a .env.local file in the root:

NEXT_PUBLIC_TMDB_API_KEY=your_tmdb_api_key
OPENSUBTITLES_API_KEY=your_opensubtitles_api_key

FIREBASE_API_KEY=your_firebase_api_key
FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
FIREBASE_APP_ID=your_firebase_app_id
FIREBASE_DATABASE_URL=your_realtime_db_url

4. Run locally
npm run dev

📂 Project Structure
together/
│── app/                  # Next.js App Router
│   ├── api/              # API routes (TMDb, OpenSubtitles, sync logic)
│   ├── components/       # UI components (player, chat, subtitle picker)
│   └── page.tsx          # Home page
│
│── lib/                  # Firebase + API utilities
│── public/               # Static assets
│── styles/               # Tailwind global styles
│── .env.local.example    # Example env vars
│── README.md             # Documentation

🔑 How It Works

Search a movie → TMDb API returns results.

Select a movie → fetches TMDb ID → sends it to OpenSubtitles → retrieves subtitles.

Subtitles auto-convert to .vtt → loaded into video player.

Playback state (play, pause, seek) stored in Realtime DB → synced to all users.

Firestore keeps track of rooms and users.

📸 Demo

Add screenshots / GIFs of Together in action here.

🤝 Contributing

Contributions are welcome! Open an issue or submit a PR.

📜 License

MIT License – free to use and modify.
