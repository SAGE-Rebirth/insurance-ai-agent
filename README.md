<div align="center">
<img width="1200" height="475" alt="Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# InsureVoice AI

Real-time, voice-powered AI insurance agent that provides instant policy assistance. Built with **Google's Gemini 2.5 Flash Native Audio** model using the Multimodal Live API, this application delivers a natural, human-like voice conversation experience.

[![Status](https://img.shields.io/badge/status-active-success.svg)]()
[![License](https://img.shields.io/badge/license-MIT-blue.svg)]()

---

## 📋 Table of Contents

- [Features](#-features)
- [Prerequisites](#-prerequisites)
- [Installation & Setup](#-installation--setup)
  - [Windows](#windows)
  - [macOS](#macos)
  - [Linux](#linux)
- [Usage](#-usage)
- [About the Project](#-about-the-project)
- [Technical Details](#-technical-details)
- [Contributing](#-contributing)

---

## ✨ Features

- **🗣️ Real-time Voice Interaction**: Two-way, low-latency voice conversation with AI.
- **🌏 Multi-Language Support**: Speak naturally in **English, Hindi, Gujarati, Marathi, Malayalam, Telugu, or Tamil**.
- **📜 Live Transcription**: See the conversation unfold in real-time with role-based chat bubbles.
- **📊 Audio Visualization**: Dynamic waveform visualization responsive to both user and agent speech.
- **📝 Intelligent Summarization**: Automatically generates concise summaries of your sessions.
- **💾 Session History**: Saves previous interactions locally for easy reference.
- **📄 Policy Knowledge Base**: The AI is grounded in specific insurance policy documents for accurate answers.

---

## 🛠 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher) - [Download here](https://nodejs.org/)
- **npm** (usually comes with Node.js)
- A **Google Gemini API Key** - [Get it here](https://aistudio.google.com/app/apikey)

---

## 🚀 Installation & Setup

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/insurance-ai-agent.git
cd insurance-ai-agent
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a file named `.env.local` in the root directory and add your API key:

```bash
# macOS/Linux
touch .env.local

# Windows (PowerShell)
New-Item -Path .env.local -ItemType File
```

Open the file and add:

```env
GEMINI_API_KEY=your_actual_api_key_here
```

### 4. Run the Application

#### Windows

```bash
npm run dev
```

#### macOS

```bash
npm run dev
```

#### Linux

```bash
npm run dev
```

The application will start at `http://localhost:3000`.

---

## 🎮 Usage

1.  **Select Language**: Use the dropdown in the top-right to choose your preferred language.
2.  **Connect**: Click the large **"Call Agent"** button to start the session.
3.  **Speak**: Ask questions about your insurance policy. The agent will respond vocally.
    *   *Example: "What is my vehicle coverage limit?"*
    *   *Example: "Can I add another driver to my policy?"*
4.  **View Transcript**: Read the live conversation log in the bottom panel.
5.  **Policy Panel**: Use the "Policy" tab (on mobile) or the left panel (on desktop) to view the reference policy document.
6.  **History**: Click the History icon to view and restore past session logs and summaries.

---

## ℹ️ About the Project

**InsureVoice AI** demonstrates the power of the Gemini Multimodal Live API to create specialized virtual assistants. By grounding the model with a specific context (an insurance policy document) and instructing it to adopt a persona ("Sathi"), we create a tailored experience that feels professional yet personal.

### Key Components

-   **`App.tsx`**: The main application orchestrator managing UI state, tabs, and layout.
-   **`hooks/use-live-api.ts`**: A custom hook encapsulating the WebSocket connection to Gemini, handling audio streaming and event management.
-   **`components/AudioVisualizer.tsx`**: Renders the real-time audio waveform.
-   **`components/PolicyPanel.tsx`**: Displays the editable policy text that grounds the AI's knowledge.
-   **`utils/audio-recorder.ts`**: Manages browser audio capture and processing.

---

## 🔧 Technical Details

-   **Frontend Framework**: React 19 with Vite
-   **Language**: TypeScript
-   **Styling**: Tailwind CSS
-   **AI Model**: Gemini 2.5 Flash Native Audio Preview (`gemini-2.5-flash-native-audio-preview-12-2025`)
-   **Communication**: WebSocket for real-time bidirectional audio streaming.
-   **Icons**: Lucide React

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1.  Fork the repository.
2.  Create a new branch (`git checkout -b feature/AmazingFeature`).
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4.  Push to the branch (`git push origin feature/AmazingFeature`).
5.  Open a Pull Request.

---

<div align="center">
Built with ❤️ using Google Gemini API
</div>
