# 🏏 GV Cricket Scorekeeper


**GV Cricket** is the official scorekeeping app for our league. Use it to set up teams, score matches ball-by-ball, and share live results with the community. Ditch the paper scorecard and manage everything in one place.

---

## ✨ Features

A complete, end-to-end solution for managing and scoring cricket matches.

* **🏠 Modern Homepage:** A beautiful, animated landing page with a video background that showcases the community and the app's features.
* **📋 Session Management:**
    * Create new match sessions with a unique name.
    * View a list of all past and live sessions.
    * Dynamic status indicators show if a game is **LIVE NOW** or when it **Ended**.
* **🏏 Team Selection:**
    * A fast and intuitive interface for setting up teams.
    * Quickly set player counts with `+/-` buttons.
    * Players are automatically named to save time.
    * An "Edit Mode" allows for renaming teams/players and deleting specific players from the roster.
* **🪙 Interactive Coin Toss:**
    * A 10-second countdown builds suspense before the toss.
    * Features a 3-second, 3D gold coin spin animation.
    * The winning team can choose to "Bat First" or "Bowl First", with the result saved automatically.
* **🖋️ Live Umpire Mode:**
    * The main scoring interface, protected by a PIN.
    * Simple, clear buttons for tracking every ball (runs, wides, outs, etc.).
    * An "Undo" feature to easily correct mistakes.
    * Live over-by-over history tracking.
* **👀 Live Spectator View:**
    * A shareable, real-time scoreboard that anyone can view.
    * Automatically refreshes every few seconds to show the latest score.
    * Perfect for players on the sideline or for displaying on a larger screen.
* **📊 Final Results Page:**
    * Automatically displays a clear summary of the match winner.
    * Includes detailed charts and graphs to visualize scoring progression and run rates.
    * Provides a complete ball-by-ball history for both innings.
* **📱 Fully Responsive:** Designed to work beautifully on desktop, tablets, and mobile phones.

---

## 🛠️ Tech Stack

This project is built with a modern, full-stack JavaScript toolkit.

* **Framework:** ▲ [Next.js](https://nextjs.org/)
* **UI Library:** ⚛️ [React 19](https://react.dev/)
* **Styling:** 🎨 [Tailwind CSS](https://tailwindcss.com/)
* **Database:** 🍃 [MongoDB Atlas](https://www.mongodb.com/atlas)
* **ODM:** [Mongoose](https://mongoosejs.com/)
* **Animation:** ✨ [Framer Motion](https://www.framer.com/motion/)
* **Deployment:** ▲ [Vercel](https://vercel.com/)

---

## 📦 Key NPM Packages

* `next`: The core React framework.
* `react` & `react-dom`: For building the user interface.
* `mongoose`: For modeling and connecting to the MongoDB database.
* `tailwindcss`: For all styling and UI design.
* `framer-motion`: Powers all the page transitions and component animations.
* `swr`: For client-side data fetching and real-time updates.
* `recharts`: For creating the charts on the results page.
* `@studio-freight/react-lenis`: For a smooth scrolling experience.
* `react-icons`: For all the icons used throughout the application.

---

## 🚀 Getting Started

To run this project on your local machine, follow these steps:

1.  **Clone the Repository**
    ```bash
    git clone [https://github.com/Sai4158/gvcricket.git](https://github.com/Sai4158/gvcricket.git)
    cd my-app
    ```

2.  **Create an Environment File**
    * Create a new file named `.env.local` in the root of your project.
    * Add your MongoDB connection string to this file:
        ```
        MONGODB_URI="your_mongodb_connection_string"
        ```

3.  **Install Dependencies**
    * Because this project uses React 19, some packages require a special flag during installation. Run the following command:
        ```bash
        npm install --legacy-peer-deps
        ```

4.  **Run the Development Server**
    ```bash
    npm run dev
    ```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.
