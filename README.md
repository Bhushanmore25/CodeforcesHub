# 🏆 CodeforcesHub

![CodeforcesHub](https://codeforces.com/codeforces.org/s/44188/android-icon-192x192.png) <!-- Replace with your actual logo if you have one -->

CodeforcesHub is a powerful, open-source Chrome Extension that automatically integrates your Accepted Codeforces submissions directly to your GitHub repository. It acts as your personal competitive programming portfolio builder, ensuring you never lose track of your hard-earned solutions.

## ✨ Features

- **✅ Auto-Sync:** Automatically pushes your accepted Codeforces solutions to GitHub the moment they pass all tests.
- **📁 Smart Structuring:** Organizes your code predictably using the format: `Rating_ContestName_ContestId_ProblemNumber` (e.g., `800_Codeforces_Round_198_Div_2_1988_A/Solution.cpp`).
- **📝 Problem Statements:** Automatically fetches and formats the full problem statement into a beautiful `README.md` alongside your code.
- **📊 Master Repository Dashboard:** Automatically generates and maintains a stunning root `README.md` in your repository, categorically sorting all your solved problems by their difficulty rating in clean Markdown tables.
- **🔒 Secure Authentication:** Uses the industry-standard GitHub Device Authorization Flow (OAuth 2.0). **No handling of Personal Access Tokens (PATs) or passwords required!**
- **⚡ Manual Syncing:** Missed a sync? The extension natively injects "Sync to GitHub" buttons directly onto Codeforces status pages and submission views.

---

## 🚀 Getting Started

Follow these step-by-step instructions to install and configure CodeforcesHub.

### 1. Installation

Since this extension is not yet published on the Chrome Web Store, you can easily load it locally:

1. Download or clone this repository to your local machine:
   ```bash
   git clone https://github.com/Bhushanmore25/CodeforcesHub.git
   ```
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer Mode** by toggling the switch in the top right corner.
4. Click the **Load unpacked** button in the top left.
5. Select the folder where you cloned/extracted `CodeforcesHub`.
6. The extension is now installed! Pin it to your browser toolbar for easy access.

### 2. Configuration & Authentication

1. Click on the CodeforcesHub extension icon in your Chrome toolbar.
2. Enter the **GitHub Repository** you want your code pushed to in the format `username/repository_name` (e.g., `octocat/MyCodeforces`). *Note: Make sure this repository actually exists on your GitHub!*
3. Enter your **Codeforces Handle**.
4. Click **Authenticate with GitHub**.
   - The extension will generate an 8-character device code.
   - A new GitHub tab will open automatically. Paste the code there and click **Authorize**.
   - Your extension is now securely linked via OAuth!
5. Click **Save Configurations & Start Tracking**.

That's it! Just go to [Codeforces](https://codeforces.com) and start solving. Your accepted submissions will be synced automatically!

---


## 🛠️ Built With
- Vanilla JavaScript (ES6+)
- Chrome Extension Manifest V3
- GitHub REST API v3
- Codeforces API

## 🤝 Contributing
Contributions, issues, and feature requests are always welcome! Feel free to check the [issues page](../../issues).

## 📝 License
This project is open-source and available under the [MIT License](LICENSE).
